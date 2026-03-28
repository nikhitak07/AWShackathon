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

import {
  TextractClient,
  DetectDocumentTextCommand,
  AnalyzeDocumentCommand,
  FeatureType,
} from "@aws-sdk/client-textract";
import type { APIGatewayProxyHandler } from "aws-lambda";
import type { ExtractionRequest, ExtractionResult } from "@shared/types";

const IMAGES_BUCKET = process.env.IMAGES_BUCKET ?? "discharge-images-temp";
const TIMEOUT_MS = 30_000;

const textract = new TextractClient({});

// ---------------------------------------------------------------------------
// Custom error
// ---------------------------------------------------------------------------

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

// ---------------------------------------------------------------------------
// Core extraction logic (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Calls Textract and returns concatenated raw text.
 * Selects DetectDocumentText for images, AnalyzeDocument for PDFs.
 * Throws ExtractionError on any Textract failure.
 */
export async function extractText(
  req: ExtractionRequest,
  contentType?: string
): Promise<ExtractionResult> {
  const document = {
    S3Object: { Bucket: IMAGES_BUCKET, Name: req.uploadId },
  };

  const isPdf = contentType === "application/pdf" || req.uploadId.toLowerCase().endsWith(".pdf");

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new ExtractionError("Text extraction timed out. Please try again.")),
      TIMEOUT_MS
    )
  );

  try {
    let blocks: Array<{ BlockType?: string; Text?: string }>;

    if (isPdf) {
      const result = await Promise.race([
        textract.send(
          new AnalyzeDocumentCommand({
            Document: document,
            FeatureTypes: [FeatureType.FORMS],
          })
        ),
        timeoutPromise,
      ]);
      blocks = result.Blocks ?? [];
    } else {
      const result = await Promise.race([
        textract.send(new DetectDocumentTextCommand({ Document: document })),
        timeoutPromise,
      ]);
      blocks = result.Blocks ?? [];
    }

    // Concatenate LINE blocks to preserve natural reading order
    const rawText = blocks
      .filter((b) => b.BlockType === "LINE" && b.Text)
      .map((b) => b.Text!)
      .join("\n");

    return { rawText, uploadId: req.uploadId };
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    throw new ExtractionError(
      "Text extraction failed. Please check the image quality and try again."
    );
  }
}

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------

export const extractHandler: APIGatewayProxyHandler = async (event) => {
  let body: ExtractionRequest;
  try {
    body = JSON.parse(event.body ?? "{}") as ExtractionRequest;
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  if (!body.uploadId || !body.userId) {
    return { statusCode: 400, body: JSON.stringify({ error: "uploadId and userId are required." }) };
  }

  // Derive content type from query string or body if provided
  const contentType =
    (event.queryStringParameters?.contentType as string | undefined) ??
    (body as ExtractionRequest & { contentType?: string }).contentType;

  try {
    const result = await extractText(body, contentType);
    // rawText is returned to the caller (Parser) but never written to persistent storage
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err) {
    const message =
      err instanceof ExtractionError
        ? err.message
        : "An unexpected error occurred during extraction.";
    return {
      statusCode: 500,
      body: JSON.stringify({ error: message }),
    };
  }
};
