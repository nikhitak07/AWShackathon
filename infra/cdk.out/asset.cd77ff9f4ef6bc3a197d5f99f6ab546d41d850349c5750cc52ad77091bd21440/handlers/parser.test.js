"use strict";
/**
 * Tests for the Parser handler.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.2
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fc = __importStar(require("fast-check"));
const parser_1 = require("./parser");
// ---------------------------------------------------------------------------
// Unit tests — Task 7.6
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("parseText — unit tests", () => {
    (0, vitest_1.it)("throws ParseError on empty text", () => {
        (0, vitest_1.expect)(() => (0, parser_1.parseText)("", "user-1")).toThrow(parser_1.ParseError);
    });
    (0, vitest_1.it)("throws ParseError on unrecognizable short text", () => {
        (0, vitest_1.expect)(() => (0, parser_1.parseText)("ok\nhi", "user-1")).toThrow(parser_1.ParseError);
    });
    (0, vitest_1.it)("ParseError message suggests image quality review", () => {
        (0, vitest_1.expect)(() => (0, parser_1.parseText)("", "user-1")).toThrow("No checklist items could be found. Please check the image quality and try again.");
    });
    (0, vitest_1.it)("categorizes medication items correctly", () => {
        const { items } = (0, parser_1.parseText)("Take Metformin 500mg twice daily", "user-1");
        (0, vitest_1.expect)(items[0].category).toBe("Medications");
    });
    (0, vitest_1.it)("categorizes follow-up appointment items correctly", () => {
        const { items } = (0, parser_1.parseText)("Follow-up appointment with Dr. Smith on 2026-04-10", "user-1");
        (0, vitest_1.expect)(items[0].category).toBe("FollowUpAppointments");
    });
    (0, vitest_1.it)("categorizes dietary restriction items correctly", () => {
        const { items } = (0, parser_1.parseText)("Avoid high-sodium foods and processed snacks", "user-1");
        (0, vitest_1.expect)(items[0].category).toBe("DietaryRestrictions");
    });
    (0, vitest_1.it)("categorizes warning sign items correctly", () => {
        const { items } = (0, parser_1.parseText)("Call 911 if you experience chest pain", "user-1");
        (0, vitest_1.expect)(items[0].category).toBe("WarningSigns");
    });
    (0, vitest_1.it)("categorizes daily activity items correctly", () => {
        const { items } = (0, parser_1.parseText)("Walk 10 minutes twice a day", "user-1");
        (0, vitest_1.expect)(items[0].category).toBe("DailyActivities");
    });
    (0, vitest_1.it)("extracts ISO 8601 date from item text", () => {
        const { items } = (0, parser_1.parseText)("Follow-up appointment on 2026-04-10", "user-1");
        (0, vitest_1.expect)(items[0].dateTime).toBe("2026-04-10");
    });
    (0, vitest_1.it)("extracts ISO 8601 datetime with time component", () => {
        const { items } = (0, parser_1.parseText)("Appointment at 2026-04-10T09:30", "user-1");
        (0, vitest_1.expect)(items[0].dateTime).toBe("2026-04-10T09:30");
    });
    (0, vitest_1.it)("leaves dateTime undefined when no date present", () => {
        const { items } = (0, parser_1.parseText)("Take Metformin 500mg twice daily", "user-1");
        (0, vitest_1.expect)(items[0].dateTime).toBeUndefined();
    });
    (0, vitest_1.it)("splits on newlines, bullets, and semicolons", () => {
        const { items } = (0, parser_1.parseText)("Take aspirin 81mg daily\n• Walk 10 minutes; Avoid salty foods", "user-1");
        (0, vitest_1.expect)(items.length).toBe(3);
    });
    (0, vitest_1.it)("sets userId on the returned checklist", () => {
        const { userId } = (0, parser_1.parseText)("Take aspirin 81mg daily", "user-42");
        (0, vitest_1.expect)(userId).toBe("user-42");
    });
});
// ---------------------------------------------------------------------------
// Unit tests — priority assignment (Task 7.6 + Req 11.2)
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("parseText — priority assignment", () => {
    const HIGH_CASES = [
        "Call 911 if you experience chest pain",
        "Seek emergency care for difficulty breathing",
        "Go to ER for uncontrolled bleeding",
        "Call doctor if fever develops",
        "Seek care for severe swelling",
    ];
    for (const text of HIGH_CASES) {
        (0, vitest_1.it)(`assigns High priority to: "${text}"`, () => {
            const { items } = (0, parser_1.parseText)(text, "user-1");
            (0, vitest_1.expect)(items[0].priority).toBe("High");
        });
    }
    (0, vitest_1.it)("assigns Routine priority to non-risk items", () => {
        const { items } = (0, parser_1.parseText)("Walk 10 minutes twice a day", "user-1");
        (0, vitest_1.expect)(items[0].priority).toBe("Routine");
    });
});
// ---------------------------------------------------------------------------
// Property test — Task 7.2: every input line appears in output (Req 3.4)
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("Property 2: categorization completeness", () => {
    (0, vitest_1.it)("every item in raw text appears in the output checklist", () => {
        // Lines must not contain split chars (newline, bullet, semicolon) and must be >5 chars after trim
        const lineArb = fc
            .string({ minLength: 6, maxLength: 80 })
            .filter((s) => !/[\n;•]/.test(s) && s.trim().length > 5);
        const linesArb = fc.array(lineArb, { minLength: 1, maxLength: 20 });
        fc.assert(fc.property(linesArb, (lines) => {
            const rawText = lines.join("\n");
            const checklist = (0, parser_1.parseText)(rawText, "user-prop");
            const itemTexts = checklist.items.map((i) => i.text);
            return lines.every((line) => itemTexts.includes(line.trim()));
        }));
    });
});
// ---------------------------------------------------------------------------
// Property test — Task 7.3: risk keywords → High priority (Req 11.2)
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("Property 3: priority assignment for risk keywords", () => {
    const RISK_KEYWORDS = [
        "fever",
        "chest pain",
        "difficulty breathing",
        "uncontrolled bleeding",
        "severe",
        "emergency",
        "call 911",
    ];
    (0, vitest_1.it)("any item containing a risk keyword is assigned High priority", () => {
        const keywordArb = fc.constantFrom(...RISK_KEYWORDS);
        // Ensure prefix+suffix together add enough chars so the line survives the >5 filter
        const paddingArb = fc.string({ minLength: 3, maxLength: 20 }).filter((s) => !s.includes("\n") && !s.includes(";") && !s.includes("•"));
        fc.assert(fc.property(keywordArb, paddingArb, (keyword, padding) => {
            const line = `${padding} ${keyword}`;
            // line is always >5 chars because padding is ≥3 + space + keyword
            const checklist = (0, parser_1.parseText)(line, "user-prop");
            return checklist.items.every((item) => item.priority === "High");
        }));
    });
});
// ---------------------------------------------------------------------------
// Property test — Task 7.5: round-trip consistency (Req 3.5)
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("Property 4: formatChecklist / parseChecklist round-trip", () => {
    const itemArb = fc.record({
        id: fc.uuid(),
        text: fc.string({ minLength: 1, maxLength: 100 }),
        category: fc.constantFrom("Medications", "DailyActivities", "FollowUpAppointments", "DietaryRestrictions", "WarningSigns"),
        priority: fc.constantFrom("High", "Routine"),
        dateTime: fc.option(fc.string({ minLength: 10, maxLength: 25 }), { nil: undefined }),
        completed: fc.boolean(),
    });
    const checklistArb = fc.record({
        id: fc.uuid(),
        userId: fc.string({ minLength: 1, maxLength: 50 }),
        createdAt: fc.string({ minLength: 1, maxLength: 30 }),
        updatedAt: fc.string({ minLength: 1, maxLength: 30 }),
        items: fc.array(itemArb, { minLength: 0, maxLength: 20 }),
    });
    (0, vitest_1.it)("parseChecklist(formatChecklist(c)) produces an equivalent checklist", () => {
        fc.assert(fc.property(checklistArb, (checklist) => {
            const roundTripped = (0, parser_1.parseChecklist)((0, parser_1.formatChecklist)(checklist));
            (0, vitest_1.expect)(roundTripped).toEqual(checklist);
        }));
    });
});
// ---------------------------------------------------------------------------
// Unit tests — formatChecklist / parseChecklist (Task 7.4)
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("formatChecklist / parseChecklist", () => {
    const sample = {
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
    (0, vitest_1.it)("formatChecklist produces valid JSON", () => {
        (0, vitest_1.expect)(() => JSON.parse((0, parser_1.formatChecklist)(sample))).not.toThrow();
    });
    (0, vitest_1.it)("parseChecklist restores the original checklist", () => {
        (0, vitest_1.expect)((0, parser_1.parseChecklist)((0, parser_1.formatChecklist)(sample))).toEqual(sample);
    });
    (0, vitest_1.it)("parseChecklist throws ParseError on invalid JSON", () => {
        (0, vitest_1.expect)(() => (0, parser_1.parseChecklist)("not json")).toThrow(parser_1.ParseError);
    });
    (0, vitest_1.it)("parseChecklist throws ParseError on missing required fields", () => {
        (0, vitest_1.expect)(() => (0, parser_1.parseChecklist)('{"id":"x"}')).toThrow(parser_1.ParseError);
    });
});
