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
import type { APIGatewayProxyHandler } from "aws-lambda";
import type { ExtractionRequest, ExtractionResult } from "@shared/types";
export declare class ExtractionError extends Error {
    constructor(message: string);
}
/**
 * Calls Textract and returns concatenated raw text.
 * Selects DetectDocumentText for images, AnalyzeDocument for PDFs.
 * Throws ExtractionError on any Textract failure.
 */
export declare function extractText(req: ExtractionRequest, contentType?: string): Promise<ExtractionResult>;
export declare const extractHandler: APIGatewayProxyHandler;
