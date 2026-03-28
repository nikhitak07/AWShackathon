/**
 * Uploader Lambda handler — validates files and generates pre-signed S3 PUT URLs.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 9.1, 9.2
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import type { APIGatewayProxyHandler } from "aws-lambda";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json",
};
const IMAGES_BUCKET = process.env.IMAGES_BUCKET ?? "discharge-images-temp";
const PRESIGNED_URL_EXPIRES_IN = 300;

const s3 = new S3Client({});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

// ---------------------------------------------------------------------------
// Core validation logic (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Validates a file's MIME type and size.
 * Throws UploadValidationError on any violation.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export function validateFile(mimeType: string, sizeBytes: number): void {
  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new UploadValidationError(
      `Unsupported file type "${mimeType}". Only JPEG, PNG, and PDF files are accepted.`
    );
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new UploadValidationError(
      `File size ${(sizeBytes / (1024 * 1024)).toFixed(1)} MB exceeds the 10 MB limit.`
    );
  }
}

// ---------------------------------------------------------------------------
// Pre-signed URL generation (exported for unit testing)
// ---------------------------------------------------------------------------

export interface UploadUrlRequest {
  fileName: string;
  contentType: string;
  fileSizeBytes?: number;
}

export interface UploadUrlResponse {
  uploadId: string;
  uploadUrl: string;
}

/**
 * Generates a pre-signed S3 PUT URL for the given file.
 * Requirements: 9.1, 9.2
 */
export async function getUploadUrl(req: UploadUrlRequest): Promise<UploadUrlResponse> {
  const ext = req.fileName.includes(".") ? req.fileName.split(".").pop() : "";
  const uploadId = ext ? `${uuidv4()}.${ext}` : uuidv4();

  const command = new PutObjectCommand({
    Bucket: IMAGES_BUCKET,
    Key: uploadId,
    ContentType: req.contentType,
    // SSE-S3 encryption enforced at bucket level; no extra header needed
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: PRESIGNED_URL_EXPIRES_IN,
  });

  return { uploadId, uploadUrl };
}

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------

export const uploadHandler: APIGatewayProxyHandler = async (event) => {
  let body: UploadUrlRequest;
  try {
    body = JSON.parse(event.body ?? "{}") as UploadUrlRequest;
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  const { fileName, contentType, fileSizeBytes } = body;

  if (!fileName || !contentType) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "fileName and contentType are required." }) };
  }

  try {
    validateFile(contentType, fileSizeBytes ?? 0);
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
    }
    throw err;
  }

  try {
    const result = await getUploadUrl({ fileName, contentType, fileSizeBytes });
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) };
  } catch {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: "Failed to generate upload URL. Please try again." }) };
  }
};
