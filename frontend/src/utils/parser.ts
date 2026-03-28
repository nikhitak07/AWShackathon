import type { Checklist, ChecklistItem, Category, PriorityLevel } from "@shared/types";
import { v4 as uuidv4 } from "uuid";

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  Medications: ["mg", "tablet", "capsule", "pill", "dose", "medication", "drug", "prescription", "take", "inject"],
  FollowUpAppointments: ["appointment", "follow", "visit", "doctor", "clinic", "schedule", "see your", "return", "check-up"],
  DietaryRestrictions: ["eat", "food", "diet", "drink", "avoid", "sodium", "sugar", "fat", "calorie", "fluid", "water"],
  WarningSigns: ["fever", "chest pain", "bleeding", "breathing", "swelling", "pain", "emergency", "call 911", "severe", "sudden"],
  DailyActivities: ["walk", "exercise", "rest", "sleep", "shower", "bathe", "lift", "activity", "drive", "work", "stairs"],
};

const HIGH_PRIORITY_KEYWORDS = ["fever", "chest pain", "difficulty breathing", "uncontrolled bleeding", "severe", "emergency", "call 911"];

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

function extractDateTime(text: string): string | undefined {
  const match = text.match(/\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/);
  return match?.[0];
}

export function parseText(rawText: string, userId: string): Checklist {
  const lines = rawText
    .split(/\n|•|;/)
    .map((l) => l.trim())
    .filter((l) => l.length > 5);

  if (lines.length === 0) {
    throw new Error("No checklist items could be found. Please check the image quality and try again.");
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

// Demo checklist for local development
export function getMockChecklist(userId = "demo-user"): Checklist {
  const now = new Date().toISOString();
  return parseText(
    [
      "Take Metformin 500mg twice daily with meals",
      "Take Lisinopril 10mg once daily in the morning",
      "Follow-up appointment with Dr. Smith on 2026-04-10",
      "Schedule cardiology visit within 2 weeks",
      "Avoid high-sodium foods and processed snacks",
      "Drink at least 8 glasses of water daily",
      "Walk 10 minutes twice a day, increase gradually",
      "No heavy lifting over 10 lbs for 4 weeks",
      "Call 911 or go to ER if you experience chest pain",
      "Seek emergency care for difficulty breathing or severe swelling",
      "Monitor blood pressure daily and record readings",
      "Rest and avoid strenuous activity for 1 week",
    ].join("\n"),
    userId
  );
}
