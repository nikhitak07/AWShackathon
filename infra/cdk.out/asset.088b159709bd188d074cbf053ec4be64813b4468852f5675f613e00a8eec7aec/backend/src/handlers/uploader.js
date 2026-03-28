"use strict";
/**
 * Uploader Lambda handler — validates files and generates pre-signed S3 PUT URLs.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 9.1, 9.2
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadHandler = exports.UploadValidationError = exports.MAX_FILE_SIZE_BYTES = exports.ACCEPTED_MIME_TYPES = void 0;
exports.validateFile = validateFile;
exports.getUploadUrl = getUploadUrl;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const uuid_1 = require("uuid");
const IMAGES_BUCKET = process.env.IMAGES_BUCKET ?? "discharge-images-temp";
const PRESIGNED_URL_EXPIRES_IN = 300; // 5 minutes to complete the PUT
const s3 = new client_s3_1.S3Client({});
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
exports.ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
exports.MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------
class UploadValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "UploadValidationError";
    }
}
exports.UploadValidationError = UploadValidationError;
// ---------------------------------------------------------------------------
// Core validation logic (exported for unit testing)
// ---------------------------------------------------------------------------
/**
 * Validates a file's MIME type and size.
 * Throws UploadValidationError on any violation.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
function validateFile(mimeType, sizeBytes) {
    if (!exports.ACCEPTED_MIME_TYPES.includes(mimeType)) {
        throw new UploadValidationError(`Unsupported file type "${mimeType}". Only JPEG, PNG, and PDF files are accepted.`);
    }
    if (sizeBytes > exports.MAX_FILE_SIZE_BYTES) {
        throw new UploadValidationError(`File size ${(sizeBytes / (1024 * 1024)).toFixed(1)} MB exceeds the 10 MB limit.`);
    }
}
/**
 * Generates a pre-signed S3 PUT URL for the given file.
 * Requirements: 9.1, 9.2
 */
async function getUploadUrl(req) {
    const ext = req.fileName.includes(".") ? req.fileName.split(".").pop() : "";
    const uploadId = ext ? `${(0, uuid_1.v4)()}.${ext}` : (0, uuid_1.v4)();
    const command = new client_s3_1.PutObjectCommand({
        Bucket: IMAGES_BUCKET,
        Key: uploadId,
        ContentType: req.contentType,
        // SSE-S3 encryption enforced at bucket level; no extra header needed
    });
    const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3, command, {
        expiresIn: PRESIGNED_URL_EXPIRES_IN,
    });
    return { uploadId, uploadUrl };
}
// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------
const uploadHandler = async (event) => {
    let body;
    try {
        body = JSON.parse(event.body ?? "{}");
    }
    catch {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
    }
    const { fileName, contentType, fileSizeBytes } = body;
    if (!fileName || !contentType) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "fileName and contentType are required." }),
        };
    }
    try {
        // Validate MIME type; size validation only when provided by the client
        validateFile(contentType, fileSizeBytes ?? 0);
    }
    catch (err) {
        if (err instanceof UploadValidationError) {
            return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
        }
        throw err;
    }
    try {
        const result = await getUploadUrl({ fileName, contentType, fileSizeBytes });
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result),
        };
    }
    catch {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to generate upload URL. Please try again." }),
        };
    }
};
exports.uploadHandler = uploadHandler;
