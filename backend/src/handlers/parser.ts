/**
 * Parser — converts raw extracted text into a structured Checklist.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.1, 11.2
 */

import { v4 as uuidv4 } from "uuid";
import type { Checklist, ChecklistItem, Category, PriorityLevel } from "@shared/types";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

// ---------------------------------------------------------------------------
// Keyword maps
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  Medications: ["mg", "tablet", "capsule", "pill", "dose", "medication", "drug", "prescription", "take", "inject"],
  FollowUpAppointments: ["appointment", "follow", "visit", "doctor", "clinic", "schedule", "see your", "return", "check-up"],
  DietaryRestrictions: ["eat", "food", "diet", "drink", "avoid", "sodium", "sugar", "fat", "calorie", "fluid", "water"],
  WarningSigns: ["fever", "chest pain", "bleeding", "breathing", "swelling", "pain", "emergency", "call 911", "severe", "sudden"],
  DailyActivities: ["walk", "exercise", "rest", "sleep", "shower", "bathe", "lift", "activity", "drive", "work", "stairs"],
};

const HIGH_PRIORITY_KEYWORDS = [
  "fever",
  "chest pain",
  "difficulty breathing",
  "uncontrolled bleeding",
  "severe",
  "emergency",
  "call 911",
];

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

// Patterns that indicate header/metadata lines to skip
const SKIP_PATTERNS = [
  /^(patient|name|dob|date of birth|address|phone|mrn|medical record|hospital|clinic|physician|doctor|provider|discharge date|admission|room|ward|floor|unit|facility|insurance|policy|group|id#|id:|#\d)/i,
  /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/, // standalone dates
  /^\d{3}[-.\s]\d{3}[-.\s]\d{4}$/, // phone numbers
  /^[A-Z][a-z]+,?\s+[A-Z][a-z]+$/, // "Firstname Lastname" or "Lastname, Firstname"
  /^\d+$/, // pure numbers
  /^(page|pg)\s*\d/i, // page numbers
];

function shouldSkip(line: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(line.trim()));
}

function categorize(text: string): Category {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    if (keywords.some((kw) => lower.includes(kw))) return cat;
  }
  return "DailyActivities";
}

function getPriority(text: string): PriorityLevel {
  const lower = text.toLowerCase();
  return HIGH_PRIORITY_KEYWORDS.some((kw) => lower.includes(kw)) ? "High" : "Routine";
}

/** Extracts the first ISO 8601 date (with optional time) from item text. */
function extractDateTime(text: string): string | undefined {
  const match = text.match(/\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/);
  return match?.[0];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses raw extracted text into a structured Checklist.
 * Throws ParseError if no items can be found.
 */
export function parseText(rawText: string, userId: string): Checklist {
  const lines = rawText
    .split(/\n|•|;/)
    .map((l) => l.trim())
    .filter((l) => l.length > 5 && !shouldSkip(l));

  if (lines.length === 0) {
    throw new ParseError(
      "No checklist items could be found. Please check the image quality and try again."
    );
  }

  const items: ChecklistItem[] = lines.map((line) => ({
    id: uuidv4(),
    text: line,
    category: categorize(line),
    priority: getPriority(line),
    dateTime: extractDateTime(line),
    completed: false,
  }));

  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    userId,
    createdAt: now,
    updatedAt: now,
    items,
  };
}

/**
 * Serializes a Checklist to a canonical JSON string.
 */
export function formatChecklist(checklist: Checklist): string {
  return JSON.stringify(checklist);
}

/**
 * Deserializes a canonical JSON string back to a Checklist.
 * Throws ParseError if the JSON is invalid or missing required fields.
 */
export function parseChecklist(json: string): Checklist {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ParseError("Invalid checklist JSON.");
  }

  const c = parsed as Checklist;
  if (!c.id || !c.userId || !Array.isArray(c.items)) {
    throw new ParseError("Checklist JSON is missing required fields.");
  }

  return c;
}

// ---------------------------------------------------------------------------
// Lambda handler
// ---------------------------------------------------------------------------

import type { APIGatewayProxyHandler } from "aws-lambda";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json",
};

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0";

const SYSTEM_PROMPT = `You are a medical discharge document parser. Your job is to extract EVERY actionable patient care instruction from hospital discharge paperwork. It is critical that you do not miss anything.

MEDICATIONS — extract ALL of them, every single one:
- Each medication MUST be its own separate checklist item — never combine multiple drugs into one item
- Include every drug mentioned, even if it appears in a list or table
- Include the full name (brand and/or generic), exact dosage, frequency, route (oral, topical, etc.), and duration if stated
- If you see 5 medications, you must produce 5 separate medication items — do not group or summarize them
- Example item 1: "Take Metformin 500mg by mouth twice daily with meals for 30 days"
- Example item 2: "Take Lisinopril 10mg by mouth once daily in the morning"

FOLLOW-UP APPOINTMENTS — extract ALL of them:
- Doctor visits, specialist referrals, lab work, blood tests, imaging (X-ray, MRI, ultrasound)
- Include the provider name/specialty and timeframe if mentioned
- Example: "Follow up with Dr. Smith (cardiologist) in 2 weeks"

DIETARY RESTRICTIONS — extract ALL of them:
- Foods and drinks to avoid or limit
- Fluid intake instructions
- Special diets (low sodium, diabetic, etc.)

WARNING SIGNS — extract ALL of them:
- Every symptom or situation that requires calling a doctor or going to the ER
- Be specific — include the exact symptom described

DAILY ACTIVITY INSTRUCTIONS — extract ALL of them:
- Exercise restrictions, lifting limits, driving restrictions
- Wound care, dressing changes, incision care
- Bathing, showering restrictions
- Rest and sleep instructions
- Any other activity-related instruction

RULES:
- COMPLETENESS IS THE TOP PRIORITY — it is better to include too many items than to miss one
- Each item must be a complete, specific, standalone instruction
- Preserve exact dosages, frequencies, and timeframes from the document — do not paraphrase or generalize
- Combine fragmented OCR lines into one coherent instruction if they clearly belong together
- Do not duplicate items
- NEVER refuse or ask for more information — always return whatever items you can find from the text provided
- If the text is partial or truncated, extract what you can
- Priority is "High" ONLY for: fever, chest pain, difficulty breathing, uncontrolled bleeding, severe symptoms, call 911, go to ER
- All others are "Routine"

EXCLUDE only:
- Patient name, date of birth, address, phone number, MRN, insurance info
- Hospital name, physician name, nurse name, department headers
- Admission/discharge dates, room numbers, page numbers
- Signatures, billing information
- Pure labels or headers with zero actionable content

Return ONLY a JSON array with this exact shape, no markdown, no explanation:
[{"text":"full specific instruction text","category":"Medications|FollowUpAppointments|DietaryRestrictions|WarningSigns|DailyActivities","priority":"High|Routine","dateTime":"YYYY-MM-DD or null"}]`;

async function parseWithBedrock(rawText: string, userId: string): Promise<Checklist> {
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Extract all checklist items from this discharge document text. Even if the text appears incomplete or truncated, extract every actionable instruction you can find. Do not ask for more information — just extract what is present:\n\n${rawText}` }],
    }),
  }));

  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const content = responseBody.content?.[0]?.text ?? "[]";
  console.log("Bedrock raw response:", content.substring(0, 500));

  // Extract JSON array from response (Claude sometimes adds markdown)
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new ParseError("No checklist items could be found. Please check the image quality and try again.");

  const items: Array<{ text: string; category: Category; priority: PriorityLevel; dateTime?: string | null }> =
    JSON.parse(jsonMatch[0]);

  if (!items.length) {
    throw new ParseError("No checklist items could be found. Please check the image quality and try again.");
  }

  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    userId,
    createdAt: now,
    updatedAt: now,
    items: items.map((item) => ({
      id: uuidv4(),
      text: item.text,
      category: item.category,
      priority: item.priority,
      dateTime: item.dateTime ?? undefined,
      completed: false,
    })),
  };
}

export const parseHandler: APIGatewayProxyHandler = async (event) => {
  let body: { rawText?: string; userId?: string };
  try {
    body = JSON.parse(event.body ?? "{}");
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid request body." }) };
  }

  const { rawText, userId } = body;
  if (!rawText || !userId) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "rawText and userId are required." }) };
  }

  console.log(`parseHandler received rawText (${rawText.length} chars):`, rawText.substring(0, 300));

  try {
    const checklist = await parseWithBedrock(rawText, userId);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(checklist) };
  } catch (err) {
    console.error("parseHandler error:", err);
    const message = err instanceof ParseError ? err.message : "Failed to generate checklist.";
    return { statusCode: 422, headers: CORS_HEADERS, body: JSON.stringify({ error: message }) };
  }
};
