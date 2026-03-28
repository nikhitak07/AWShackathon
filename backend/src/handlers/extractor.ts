/**
 * Extractor Lambda handler — calls Amazon Rekognition to extract text from
 * uploaded images stored in S3.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 9.4
 */

import {
  RekognitionClient,
  DetectTextCommand,
} from "@aws-sdk/client-rekognition";
import type { APIGatewayProxyHandler } from "aws-lambda";
import type { ExtractionRequest, ExtractionResult } from "@shared/types";

const IMAGES_BUCKET = process.env.IMAGES_BUCKET ?? "discharge-images-temp";
const TIMEOUT_MS = 30_000;

const rekognition = new RekognitionClient({});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json",
};

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

export async function extractText(
  req: ExtractionRequest,
  contentType?: string
): Promise<ExtractionResult> {
  const isPdf = contentType === "application/pdf" || req.uploadId.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    throw new ExtractionError("PDF extraction is not supported. Please upload a JPEG or PNG image.");
  }

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new ExtractionError("Text extraction timed out. Please try again.")), TIMEOUT_MS)
  );

  try {
    const result = await Promise.race([
      rekognition.send(new DetectTextCommand({
        Image: { S3Object: { Bucket: IMAGES_BUCKET, Name: req.uploadId } },
      })),
      timeoutPromise,
    ]);

    const rawText = (result.TextDetections ?? [])
      .filter((d) => d.Type === "LINE" && d.DetectedText)
      .map((d) => d.DetectedText!)
      .join("\n");

    console.log(`Rekognition extracted ${rawText.split("\n").length} lines, ${rawText.length} chars`);

    return { rawText, uploadId: req.uploadId };
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    console.error("Rekognition error:", err);
    throw new ExtractionError("Text extraction failed. Please check the image quality and try again.");
  }
}

export const extractHandler: APIGatewayProxyHandler = async (event) => {
  let body: ExtractionRequest & { contentType?: string };
  try {
    body = JSON.parse(event.body ?? "{}") as ExtractionRequest & { contentType?: string };
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  if (!body.uploadId || !body.userId) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "uploadId and userId are required." }) };
  }

  const contentType = (event.queryStringParameters?.contentType as string | undefined) ?? body.contentType;

  try {
    const result = await extractText(body, contentType);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) };
  } catch (err) {
    console.error("extractHandler error:", err);
    const message = err instanceof ExtractionError ? err.message : "An unexpected error occurred during extraction.";
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: message }) };
  }
};
