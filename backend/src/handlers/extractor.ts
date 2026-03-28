/**
 * Extractor Lambda handler — uses Claude vision to extract text from
 * uploaded images stored in S3.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 9.4
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { APIGatewayProxyHandler } from "aws-lambda";
import type { ExtractionRequest, ExtractionResult } from "@shared/types";

const IMAGES_BUCKET = process.env.IMAGES_BUCKET ?? "discharge-images-temp";

const s3 = new S3Client({});
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const MODEL_ID = "us.anthropic.claude-3-5-haiku-20241022-v1:0";

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

  // Fetch image from S3
  const s3Res = await s3.send(new GetObjectCommand({
    Bucket: IMAGES_BUCKET,
    Key: req.uploadId,
  }));

  const imageBytes = await s3Res.Body!.transformToByteArray();
  const base64Image = Buffer.from(imageBytes).toString("base64");
  const mediaType = (contentType ?? "image/jpeg").replace("image/jpg", "image/jpeg");

  // Send to Claude vision
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Image },
          },
          {
            type: "text",
            text: "Please extract ALL text from this medical discharge document exactly as it appears. Include every line, every medication, every instruction. Return only the raw extracted text, no commentary.",
          },
        ],
      }],
    }),
  }));

  const body = JSON.parse(new TextDecoder().decode(response.body));
  const rawText = body.content?.[0]?.text ?? "";

  console.log(`Claude vision extracted ${rawText.length} chars:`, rawText.substring(0, 300));

  if (!rawText.trim()) {
    throw new ExtractionError("No text could be extracted from the image. Please check the image quality and try again.");
  }

  return { rawText, uploadId: req.uploadId };
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
    const message = err instanceof ExtractionError ? err.message : "An unexpected error occurred during extraction.";
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: message }) };
  }
};
