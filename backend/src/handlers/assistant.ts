/**
 * AI Assistant Lambda handler — answers questions about the user's checklist
 * using Amazon Bedrock (Claude 3 Haiku).
 *
 * - Only the structured checklist is sent to Bedrock (no raw PHI)
 * - Disclaimer appended to every response
 * - Responds within 10 seconds under normal conditions
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.10
 */

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { APIGatewayProxyHandler } from "aws-lambda";
import type { AssistantRequest, AssistantResponse, Message } from "@shared/types";

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0";

const DISCLAIMER =
  "This information is for general guidance only and does not constitute medical advice. Always follow your healthcare provider's instructions and contact them with any concerns.";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json",
};

const SYSTEM_PROMPT = `You are a helpful medical discharge assistant. 
You help patients understand their discharge instructions.
You have access to the patient's structured discharge checklist.
Answer questions clearly and simply. Be concise.
Do NOT reveal or discuss any personal identifiers (name, DOB, address, MRN).
Only reference information from the provided checklist context.
If asked something outside the checklist scope, politely redirect to their healthcare provider.`;

export async function askAssistant(req: AssistantRequest): Promise<AssistantResponse> {
  // Build checklist summary to send as context (no raw PHI)
  const checklistSummary = req.checklistContext.items
    .map((item) => `[${item.category}] ${item.priority === "High" ? "⚠️ HIGH PRIORITY: " : ""}${item.text}${item.dateTime ? ` (${item.dateTime})` : ""}`)
    .join("\n");

  // Build conversation history for Bedrock
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    // Inject checklist context as first user message
    {
      role: "user",
      content: `Here is my discharge checklist:\n\n${checklistSummary}\n\nPlease help me understand it.`,
    },
    {
      role: "assistant",
      content: "I've reviewed your discharge checklist. I'm ready to answer any questions you have about your instructions.",
    },
    // Add conversation history
    ...req.conversationHistory.map((m: Message) => ({
      role: m.role,
      content: m.content,
    })),
    // Current question
    { role: "user", content: req.question },
  ];

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    }),
  }));

  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const answer = responseBody.content?.[0]?.text ?? "I'm sorry, I couldn't generate a response. Please try again.";

  return { answer, disclaimer: DISCLAIMER };
}

export const assistantHandler: APIGatewayProxyHandler = async (event) => {
  let body: AssistantRequest;
  try {
    body = JSON.parse(event.body ?? "{}") as AssistantRequest;
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  if (!body.question || !body.checklistContext) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "question and checklistContext are required." }) };
  }

  try {
    const result = await askAssistant(body);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) };
  } catch (err) {
    console.error("Bedrock assistant error:", err);
    return {
      statusCode: 503,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "The AI assistant is temporarily unavailable. Please try again later." }),
    };
  }
};
