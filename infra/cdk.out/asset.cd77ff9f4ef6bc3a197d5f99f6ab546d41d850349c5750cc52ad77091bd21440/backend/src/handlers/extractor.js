"use strict";
/**
 * Extractor Lambda handler — calls Amazon Textract to extract text from
 * uploaded images/PDFs stored in S3.
 *
 * - Images (JPEG/PNG): uses DetectDocumentText
 * - PDFs: uses AnalyzeDocument with FORMS feature
 * - Enforces 30-second timeout (Req 2.5)
 * - Never persists raw extracted text (Req 9.4)
 * - Throws ExtractionError on Textract failure (Req 2.3)
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 9.4
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractHandler = exports.ExtractionError = void 0;
exports.extractText = extractText;
const client_textract_1 = require("@aws-sdk/client-textract");
const IMAGES_BUCKET = process.env.IMAGES_BUCKET ?? "discharge-images-temp";
const TIMEOUT_MS = 30000;
const textract = new client_textract_1.TextractClient({});
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Content-Type": "application/json",
};
// ---------------------------------------------------------------------------
// Custom error
// ---------------------------------------------------------------------------
class ExtractionError extends Error {
    constructor(message) {
        super(message);
        this.name = "ExtractionError";
    }
}
exports.ExtractionError = ExtractionError;
// ---------------------------------------------------------------------------
// Core extraction logic (exported for unit testing)
// ---------------------------------------------------------------------------
/**
 * Calls Textract and returns concatenated raw text.
 * Selects DetectDocumentText for images, AnalyzeDocument for PDFs.
 * Throws ExtractionError on any Textract failure.
 */
async function extractText(req, contentType) {
    const document = {
        S3Object: { Bucket: IMAGES_BUCKET, Name: req.uploadId },
    };
    const isPdf = contentType === "application/pdf" || req.uploadId.toLowerCase().endsWith(".pdf");
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new ExtractionError("Text extraction timed out. Please try again.")), TIMEOUT_MS));
    try {
        let blocks;
        if (isPdf) {
            const result = await Promise.race([
                textract.send(new client_textract_1.AnalyzeDocumentCommand({
                    Document: document,
                    FeatureTypes: [client_textract_1.FeatureType.FORMS],
                })),
                timeoutPromise,
            ]);
            blocks = result.Blocks ?? [];
        }
        else {
            const result = await Promise.race([
                textract.send(new client_textract_1.DetectDocumentTextCommand({ Document: document })),
                timeoutPromise,
            ]);
            blocks = result.Blocks ?? [];
        }
        // Concatenate LINE blocks to preserve natural reading order
        const rawText = blocks
            .filter((b) => b.BlockType === "LINE" && b.Text)
            .map((b) => b.Text)
            .join("\n");
        return { rawText, uploadId: req.uploadId };
    }
    catch (err) {
        if (err instanceof ExtractionError)
            throw err;
        throw new ExtractionError("Text extraction failed. Please check the image quality and try again.");
    }
}
// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------
const extractHandler = async (event) => {
    let body;
    try {
        body = JSON.parse(event.body ?? "{}");
    }
    catch {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid request body." }) };
    }
    if (!body.uploadId || !body.userId) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "uploadId and userId are required." }) };
    }
    // Derive content type from query string or body if provided
    const contentType = event.queryStringParameters?.contentType ??
        body.contentType;
    try {
        const result = await extractText(body, contentType);
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify(result),
        };
    }
    catch (err) {
        const message = err instanceof ExtractionError ? err.message : "An unexpected error occurred during extraction.";
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: message }) };
    }
};
exports.extractHandler = extractHandler;
