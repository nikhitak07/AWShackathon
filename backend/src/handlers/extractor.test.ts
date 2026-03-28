/**
 * Unit tests for the Extractor handler.
 *
 * Requirements: 2.3, 9.4
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures mockSend is available when the hoisted vi.mock factory runs
const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("@aws-sdk/client-textract", () => ({
  TextractClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
  DetectDocumentTextCommand: vi.fn().mockImplementation((input) => ({ input })),
  AnalyzeDocumentCommand: vi.fn().mockImplementation((input) => ({ input })),
  FeatureType: { FORMS: "FORMS" },
}));

import { extractText, ExtractionError } from "./extractor";

const BASE_REQ = { uploadId: "test-key.jpg", userId: "user-123" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Test: ExtractionError thrown on Textract failure (Req 2.3)
// ---------------------------------------------------------------------------

describe("extractText — Textract failure", () => {
  it("throws ExtractionError when Textract rejects", async () => {
    mockSend.mockRejectedValueOnce(new Error("Textract service unavailable"));
    await expect(extractText(BASE_REQ)).rejects.toThrow(ExtractionError);
  });

  it("surfaces user-friendly message on Textract failure", async () => {
    mockSend.mockRejectedValueOnce(new Error("Textract service unavailable"));
    await expect(extractText(BASE_REQ)).rejects.toThrow(
      "Text extraction failed. Please check the image quality and try again."
    );
  });

  it("preserves ExtractionError message when already an ExtractionError", async () => {
    mockSend.mockRejectedValueOnce(
      new ExtractionError("Text extraction timed out. Please try again.")
    );
    await expect(extractText(BASE_REQ)).rejects.toThrow(
      "Text extraction timed out. Please try again."
    );
  });
});

// ---------------------------------------------------------------------------
// Test: raw text is NOT persisted — result only contains rawText + uploadId (Req 9.4)
// ---------------------------------------------------------------------------

describe("extractText — result shape (Req 9.4)", () => {
  it("returns only rawText and uploadId — no extra PHI fields", async () => {
    mockSend.mockResolvedValueOnce({
      Blocks: [
        { BlockType: "LINE", Text: "Take aspirin 81mg daily" },
        { BlockType: "LINE", Text: "Follow up with cardiologist in 2 weeks" },
        { BlockType: "WORD", Text: "aspirin" }, // WORD blocks should be excluded
      ],
    });

    const result = await extractText(BASE_REQ);

    expect(Object.keys(result)).toEqual(["rawText", "uploadId"]);
    expect(result.uploadId).toBe(BASE_REQ.uploadId);
    // Only LINE blocks concatenated; WORD blocks excluded
    expect(result.rawText).toBe(
      "Take aspirin 81mg daily\nFollow up with cardiologist in 2 weeks"
    );
  });

  it("returns empty rawText when Textract returns no LINE blocks", async () => {
    mockSend.mockResolvedValueOnce({ Blocks: [] });
    const result = await extractText(BASE_REQ);
    expect(result.rawText).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Test: PDF uses AnalyzeDocument, images use DetectDocumentText
// ---------------------------------------------------------------------------

describe("extractText — routing by content type", () => {
  it("uses DetectDocumentText for JPEG", async () => {
    const { DetectDocumentTextCommand } = await import("@aws-sdk/client-textract");
    mockSend.mockResolvedValueOnce({ Blocks: [] });

    await extractText(BASE_REQ, "image/jpeg");

    expect(DetectDocumentTextCommand).toHaveBeenCalledTimes(1);
  });

  it("uses AnalyzeDocument for PDF content type", async () => {
    const { AnalyzeDocumentCommand } = await import("@aws-sdk/client-textract");
    mockSend.mockResolvedValueOnce({ Blocks: [] });

    await extractText({ uploadId: "doc.pdf", userId: "user-123" }, "application/pdf");

    expect(AnalyzeDocumentCommand).toHaveBeenCalledTimes(1);
  });

  it("infers PDF from .pdf extension when no contentType provided", async () => {
    const { AnalyzeDocumentCommand } = await import("@aws-sdk/client-textract");
    mockSend.mockResolvedValueOnce({ Blocks: [] });

    await extractText({ uploadId: "discharge.pdf", userId: "user-123" });

    expect(AnalyzeDocumentCommand).toHaveBeenCalledTimes(1);
  });
});
