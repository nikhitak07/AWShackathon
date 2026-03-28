/**
 * Tests for the Parser handler.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.2
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { parseText, formatChecklist, parseChecklist, ParseError } from "./parser";
import type { Checklist, ChecklistItem, Category, PriorityLevel } from "@shared/types";

// ---------------------------------------------------------------------------
// Unit tests — Task 7.6
// ---------------------------------------------------------------------------

describe("parseText — unit tests", () => {
  it("throws ParseError on empty text", () => {
    expect(() => parseText("", "user-1")).toThrow(ParseError);
  });

  it("throws ParseError on unrecognizable short text", () => {
    expect(() => parseText("ok\nhi", "user-1")).toThrow(ParseError);
  });

  it("ParseError message suggests image quality review", () => {
    expect(() => parseText("", "user-1")).toThrow(
      "No checklist items could be found. Please check the image quality and try again."
    );
  });

  it("categorizes medication items correctly", () => {
    const { items } = parseText("Take Metformin 500mg twice daily", "user-1");
    expect(items[0].category).toBe("Medications");
  });

  it("categorizes follow-up appointment items correctly", () => {
    const { items } = parseText("Follow-up appointment with Dr. Smith on 2026-04-10", "user-1");
    expect(items[0].category).toBe("FollowUpAppointments");
  });

  it("categorizes dietary restriction items correctly", () => {
    const { items } = parseText("Avoid high-sodium foods and processed snacks", "user-1");
    expect(items[0].category).toBe("DietaryRestrictions");
  });

  it("categorizes warning sign items correctly", () => {
    const { items } = parseText("Call 911 if you experience chest pain", "user-1");
    expect(items[0].category).toBe("WarningSigns");
  });

  it("categorizes daily activity items correctly", () => {
    const { items } = parseText("Walk 10 minutes twice a day", "user-1");
    expect(items[0].category).toBe("DailyActivities");
  });

  it("extracts ISO 8601 date from item text", () => {
    const { items } = parseText("Follow-up appointment on 2026-04-10", "user-1");
    expect(items[0].dateTime).toBe("2026-04-10");
  });

  it("extracts ISO 8601 datetime with time component", () => {
    const { items } = parseText("Appointment at 2026-04-10T09:30", "user-1");
    expect(items[0].dateTime).toBe("2026-04-10T09:30");
  });

  it("leaves dateTime undefined when no date present", () => {
    const { items } = parseText("Take Metformin 500mg twice daily", "user-1");
    expect(items[0].dateTime).toBeUndefined();
  });

  it("splits on newlines, bullets, and semicolons", () => {
    const { items } = parseText(
      "Take aspirin 81mg daily\n• Walk 10 minutes; Avoid salty foods",
      "user-1"
    );
    expect(items.length).toBe(3);
  });

  it("sets userId on the returned checklist", () => {
    const { userId } = parseText("Take aspirin 81mg daily", "user-42");
    expect(userId).toBe("user-42");
  });
});

// ---------------------------------------------------------------------------
// Unit tests — priority assignment (Task 7.6 + Req 11.2)
// ---------------------------------------------------------------------------

describe("parseText — priority assignment", () => {
  const HIGH_CASES = [
    "Call 911 if you experience chest pain",
    "Seek emergency care for difficulty breathing",
    "Go to ER for uncontrolled bleeding",
    "Call doctor if fever develops",
    "Seek care for severe swelling",
  ];

  for (const text of HIGH_CASES) {
    it(`assigns High priority to: "${text}"`, () => {
      const { items } = parseText(text, "user-1");
      expect(items[0].priority).toBe("High");
    });
  }

  it("assigns Routine priority to non-risk items", () => {
    const { items } = parseText("Walk 10 minutes twice a day", "user-1");
    expect(items[0].priority).toBe("Routine");
  });
});

// ---------------------------------------------------------------------------
// Property test — Task 7.2: every input line appears in output (Req 3.4)
// ---------------------------------------------------------------------------

describe("Property 2: categorization completeness", () => {
  it("every item in raw text appears in the output checklist", () => {
    // Lines must not contain split chars (newline, bullet, semicolon) and must be >5 chars after trim
    const lineArb = fc
      .string({ minLength: 6, maxLength: 80 })
      .filter((s) => !/[\n;•]/.test(s) && s.trim().length > 5);
    const linesArb = fc.array(lineArb, { minLength: 1, maxLength: 20 });

    fc.assert(
      fc.property(linesArb, (lines) => {
        const rawText = lines.join("\n");
        const checklist = parseText(rawText, "user-prop");
        const itemTexts = checklist.items.map((i) => i.text);
        return lines.every((line) => itemTexts.includes(line.trim()));
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Property test — Task 7.3: risk keywords → High priority (Req 11.2)
// ---------------------------------------------------------------------------

describe("Property 3: priority assignment for risk keywords", () => {
  const RISK_KEYWORDS = [
    "fever",
    "chest pain",
    "difficulty breathing",
    "uncontrolled bleeding",
    "severe",
    "emergency",
    "call 911",
  ];

  it("any item containing a risk keyword is assigned High priority", () => {
    const keywordArb = fc.constantFrom(...RISK_KEYWORDS);
    // Ensure prefix+suffix together add enough chars so the line survives the >5 filter
    const paddingArb = fc.string({ minLength: 3, maxLength: 20 }).filter((s) => !s.includes("\n") && !s.includes(";") && !s.includes("•"));

    fc.assert(
      fc.property(keywordArb, paddingArb, (keyword, padding) => {
        const line = `${padding} ${keyword}`;
        // line is always >5 chars because padding is ≥3 + space + keyword
        const checklist = parseText(line, "user-prop");
        return checklist.items.every((item) => item.priority === "High");
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Property test — Task 7.5: round-trip consistency (Req 3.5)
// ---------------------------------------------------------------------------

describe("Property 4: formatChecklist / parseChecklist round-trip", () => {
  const itemArb: fc.Arbitrary<ChecklistItem> = fc.record({
    id: fc.uuid(),
    text: fc.string({ minLength: 1, maxLength: 100 }),
    category: fc.constantFrom<Category>(
      "Medications",
      "DailyActivities",
      "FollowUpAppointments",
      "DietaryRestrictions",
      "WarningSigns"
    ),
    priority: fc.constantFrom<PriorityLevel>("High", "Routine"),
    dateTime: fc.option(fc.string({ minLength: 10, maxLength: 25 }), { nil: undefined }),
    completed: fc.boolean(),
  });

  const checklistArb: fc.Arbitrary<Checklist> = fc.record({
    id: fc.uuid(),
    userId: fc.string({ minLength: 1, maxLength: 50 }),
    createdAt: fc.string({ minLength: 1, maxLength: 30 }),
    updatedAt: fc.string({ minLength: 1, maxLength: 30 }),
    items: fc.array(itemArb, { minLength: 0, maxLength: 20 }),
  });

  it("parseChecklist(formatChecklist(c)) produces an equivalent checklist", () => {
    fc.assert(
      fc.property(checklistArb, (checklist) => {
        const roundTripped = parseChecklist(formatChecklist(checklist));
        expect(roundTripped).toEqual(checklist);
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests — formatChecklist / parseChecklist (Task 7.4)
// ---------------------------------------------------------------------------

describe("formatChecklist / parseChecklist", () => {
  const sample: Checklist = {
    id: "abc-123",
    userId: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        id: "item-1",
        text: "Take aspirin 81mg daily",
        category: "Medications",
        priority: "Routine",
        completed: false,
      },
    ],
  };

  it("formatChecklist produces valid JSON", () => {
    expect(() => JSON.parse(formatChecklist(sample))).not.toThrow();
  });

  it("parseChecklist restores the original checklist", () => {
    expect(parseChecklist(formatChecklist(sample))).toEqual(sample);
  });

  it("parseChecklist throws ParseError on invalid JSON", () => {
    expect(() => parseChecklist("not json")).toThrow(ParseError);
  });

  it("parseChecklist throws ParseError on missing required fields", () => {
    expect(() => parseChecklist('{"id":"x"}')).toThrow(ParseError);
  });
});
