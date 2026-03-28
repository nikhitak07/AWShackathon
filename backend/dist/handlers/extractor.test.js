"use strict";
/**
 * Unit tests for the Extractor handler.
 *
 * Requirements: 2.3, 9.4
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
// vi.hoisted ensures mockSend is available when the hoisted vi.mock factory runs
const { mockSend } = vitest_1.vi.hoisted(() => ({ mockSend: vitest_1.vi.fn() }));
vitest_1.vi.mock("@aws-sdk/client-textract", () => ({
    TextractClient: vitest_1.vi.fn().mockImplementation(() => ({ send: mockSend })),
    DetectDocumentTextCommand: vitest_1.vi.fn().mockImplementation((input) => ({ input })),
    AnalyzeDocumentCommand: vitest_1.vi.fn().mockImplementation((input) => ({ input })),
    FeatureType: { FORMS: "FORMS" },
}));
const extractor_1 = require("./extractor");
const BASE_REQ = { uploadId: "test-key.jpg", userId: "user-123" };
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.clearAllMocks();
});
// ---------------------------------------------------------------------------
// Test: ExtractionError thrown on Textract failure (Req 2.3)
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("extractText — Textract failure", () => {
    (0, vitest_1.it)("throws ExtractionError when Textract rejects", async () => {
        mockSend.mockRejectedValueOnce(new Error("Textract service unavailable"));
        await (0, vitest_1.expect)((0, extractor_1.extractText)(BASE_REQ)).rejects.toThrow(extractor_1.ExtractionError);
    });
    (0, vitest_1.it)("surfaces user-friendly message on Textract failure", async () => {
        mockSend.mockRejectedValueOnce(new Error("Textract service unavailable"));
        await (0, vitest_1.expect)((0, extractor_1.extractText)(BASE_REQ)).rejects.toThrow("Text extraction failed. Please check the image quality and try again.");
    });
    (0, vitest_1.it)("preserves ExtractionError message when already an ExtractionError", async () => {
        mockSend.mockRejectedValueOnce(new extractor_1.ExtractionError("Text extraction timed out. Please try again."));
        await (0, vitest_1.expect)((0, extractor_1.extractText)(BASE_REQ)).rejects.toThrow("Text extraction timed out. Please try again.");
    });
});
// ---------------------------------------------------------------------------
// Test: raw text is NOT persisted — result only contains rawText + uploadId (Req 9.4)
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("extractText — result shape (Req 9.4)", () => {
    (0, vitest_1.it)("returns only rawText and uploadId — no extra PHI fields", async () => {
        mockSend.mockResolvedValueOnce({
            Blocks: [
                { BlockType: "LINE", Text: "Take aspirin 81mg daily" },
                { BlockType: "LINE", Text: "Follow up with cardiologist in 2 weeks" },
                { BlockType: "WORD", Text: "aspirin" }, // WORD blocks should be excluded
            ],
        });
        const result = await (0, extractor_1.extractText)(BASE_REQ);
        (0, vitest_1.expect)(Object.keys(result)).toEqual(["rawText", "uploadId"]);
        (0, vitest_1.expect)(result.uploadId).toBe(BASE_REQ.uploadId);
        // Only LINE blocks concatenated; WORD blocks excluded
        (0, vitest_1.expect)(result.rawText).toBe("Take aspirin 81mg daily\nFollow up with cardiologist in 2 weeks");
    });
    (0, vitest_1.it)("returns empty rawText when Textract returns no LINE blocks", async () => {
        mockSend.mockResolvedValueOnce({ Blocks: [] });
        const result = await (0, extractor_1.extractText)(BASE_REQ);
        (0, vitest_1.expect)(result.rawText).toBe("");
    });
});
// ---------------------------------------------------------------------------
// Test: PDF uses AnalyzeDocument, images use DetectDocumentText
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("extractText — routing by content type", () => {
    (0, vitest_1.it)("uses DetectDocumentText for JPEG", async () => {
        const { DetectDocumentTextCommand } = await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-textract")));
        mockSend.mockResolvedValueOnce({ Blocks: [] });
        await (0, extractor_1.extractText)(BASE_REQ, "image/jpeg");
        (0, vitest_1.expect)(DetectDocumentTextCommand).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("uses AnalyzeDocument for PDF content type", async () => {
        const { AnalyzeDocumentCommand } = await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-textract")));
        mockSend.mockResolvedValueOnce({ Blocks: [] });
        await (0, extractor_1.extractText)({ uploadId: "doc.pdf", userId: "user-123" }, "application/pdf");
        (0, vitest_1.expect)(AnalyzeDocumentCommand).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("infers PDF from .pdf extension when no contentType provided", async () => {
        const { AnalyzeDocumentCommand } = await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-textract")));
        mockSend.mockResolvedValueOnce({ Blocks: [] });
        await (0, extractor_1.extractText)({ uploadId: "discharge.pdf", userId: "user-123" });
        (0, vitest_1.expect)(AnalyzeDocumentCommand).toHaveBeenCalledTimes(1);
    });
});
