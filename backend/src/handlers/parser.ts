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
// Helpers
// ---------------------------------------------------------------------------

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
    .filter((l) => l.length > 5);

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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json",
};

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

  try {
    const checklist = parseText(rawText, userId);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(checklist) };
  } catch (err) {
    const message = err instanceof ParseError ? err.message : "Failed to generate checklist.";
    return { statusCode: 422, headers: CORS_HEADERS, body: JSON.stringify({ error: message }) };
  }
};
