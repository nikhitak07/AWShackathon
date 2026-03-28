"use strict";
/**
 * Parser — converts raw extracted text into a structured Checklist.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.1, 11.2
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseHandler = exports.ParseError = void 0;
exports.parseText = parseText;
exports.formatChecklist = formatChecklist;
exports.parseChecklist = parseChecklist;
const uuid_1 = require("uuid");
// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------
class ParseError extends Error {
    constructor(message) {
        super(message);
        this.name = "ParseError";
    }
}
exports.ParseError = ParseError;
// ---------------------------------------------------------------------------
// Keyword maps
// ---------------------------------------------------------------------------
const CATEGORY_KEYWORDS = {
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
function categorize(text) {
    const lower = text.toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some((kw) => lower.includes(kw)))
            return cat;
    }
    return "DailyActivities";
}
function getPriority(text) {
    const lower = text.toLowerCase();
    return HIGH_PRIORITY_KEYWORDS.some((kw) => lower.includes(kw)) ? "High" : "Routine";
}
/** Extracts the first ISO 8601 date (with optional time) from item text. */
function extractDateTime(text) {
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
function parseText(rawText, userId) {
    const lines = rawText
        .split(/\n|•|;/)
        .map((l) => l.trim())
        .filter((l) => l.length > 5);
    if (lines.length === 0) {
        throw new ParseError("No checklist items could be found. Please check the image quality and try again.");
    }
    const items = lines.map((line) => ({
        id: (0, uuid_1.v4)(),
        text: line,
        category: categorize(line),
        priority: getPriority(line),
        dateTime: extractDateTime(line),
        completed: false,
    }));
    const now = new Date().toISOString();
    return {
        id: (0, uuid_1.v4)(),
        userId,
        createdAt: now,
        updatedAt: now,
        items,
    };
}
/**
 * Serializes a Checklist to a canonical JSON string.
 */
function formatChecklist(checklist) {
    return JSON.stringify(checklist);
}
/**
 * Deserializes a canonical JSON string back to a Checklist.
 * Throws ParseError if the JSON is invalid or missing required fields.
 */
function parseChecklist(json) {
    let parsed;
    try {
        parsed = JSON.parse(json);
    }
    catch {
        throw new ParseError("Invalid checklist JSON.");
    }
    const c = parsed;
    if (!c.id || !c.userId || !Array.isArray(c.items)) {
        throw new ParseError("Checklist JSON is missing required fields.");
    }
    return c;
}
const parseHandler = async (event) => {
    let body;
    try {
        body = JSON.parse(event.body ?? "{}");
    }
    catch {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
    }
    const { rawText, userId } = body;
    if (!rawText || !userId) {
        return { statusCode: 400, body: JSON.stringify({ error: "rawText and userId are required." }) };
    }
    try {
        const checklist = parseText(rawText, userId);
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(checklist),
        };
    }
    catch (err) {
        const message = err instanceof ParseError ? err.message : "Failed to generate checklist.";
        return { statusCode: 422, body: JSON.stringify({ error: message }) };
    }
};
exports.parseHandler = parseHandler;
