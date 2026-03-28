/**
 * Uploader Lambda handler — validates files and generates pre-signed S3 PUT URLs.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 9.1, 9.2
 */
import type { APIGatewayProxyHandler } from "aws-lambda";
export declare const ACCEPTED_MIME_TYPES: readonly ["image/jpeg", "image/png", "application/pdf"];
export declare const MAX_FILE_SIZE_BYTES: number;
export declare class UploadValidationError extends Error {
    constructor(message: string);
}
/**
 * Validates a file's MIME type and size.
 * Throws UploadValidationError on any violation.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export declare function validateFile(mimeType: string, sizeBytes: number): void;
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
export declare function getUploadUrl(req: UploadUrlRequest): Promise<UploadUrlResponse>;
export declare const uploadHandler: APIGatewayProxyHandler;
