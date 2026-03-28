/**
 * Tests for the Uploader handler.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// Mock AWS SDK modules before importing uploader (same pattern as extractor tests)
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({})),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://s3.example.com/presigned"),
}));

import {
  validateFile,
  UploadValidationError,
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from "./uploader";

// ---------------------------------------------------------------------------
// Unit tests — Task 5.5
// ---------------------------------------------------------------------------

describe("validateFile — rejection of unsupported MIME types", () => {
  const INVALID_TYPES = ["image/gif", "image/webp", "text/plain", "application/zip", "video/mp4"];

  for (const mimeType of INVALID_TYPES) {
    it(`rejects "${mimeType}" with correct error message`, () => {
      expect(() => validateFile(mimeType, 1024)).toThrow(UploadValidationError);
      expect(() => validateFile(mimeType, 1024)).toThrow(
        `Unsupported file type "${mimeType}". Only JPEG, PNG, and PDF files are accepted.`
      );
    });
  }
});

describe("validateFile — rejection of files over 10 MB", () => {
  it("rejects a file of exactly 10 MB + 1 byte", () => {
    expect(() => validateFile("image/jpeg", MAX_FILE_SIZE_BYTES + 1)).toThrow(
      UploadValidationError
    );
  });

  it("error message includes the actual size in MB", () => {
    const size = 11 * 1024 * 1024; // 11 MB
    expect(() => validateFile("image/jpeg", size)).toThrow("11.0 MB exceeds the 10 MB limit");
  });

  it("rejects a very large file", () => {
    expect(() => validateFile("application/pdf", 100 * 1024 * 1024)).toThrow(
      UploadValidationError
    );
  });
});

describe("validateFile — acceptance of valid formats at boundary sizes", () => {
  it("accepts image/jpeg at exactly 10 MB", () => {
    expect(() => validateFile("image/jpeg", MAX_FILE_SIZE_BYTES)).not.toThrow();
  });

  it("accepts image/png at exactly 10 MB", () => {
    expect(() => validateFile("image/png", MAX_FILE_SIZE_BYTES)).not.toThrow();
  });

  it("accepts application/pdf at exactly 10 MB", () => {
    expect(() => validateFile("application/pdf", MAX_FILE_SIZE_BYTES)).not.toThrow();
  });

  it("accepts image/jpeg at 1 byte", () => {
    expect(() => validateFile("image/jpeg", 1)).not.toThrow();
  });

  it("accepts image/png at 0 bytes", () => {
    expect(() => validateFile("image/png", 0)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Property test — Task 5.2
// Property 1: Any file with an accepted MIME type and size ≤ 10 MB must pass
// Requirements: 1.1, 1.4
// ---------------------------------------------------------------------------

describe("Property 1: valid MIME type + size ≤ 10 MB always passes validation", () => {
  it("never throws for accepted types within size limit", () => {
    const mimeArb = fc.constantFrom(...ACCEPTED_MIME_TYPES);
    const sizeArb = fc.integer({ min: 0, max: MAX_FILE_SIZE_BYTES });

    fc.assert(
      fc.property(mimeArb, sizeArb, (mimeType, sizeBytes) => {
        expect(() => validateFile(mimeType, sizeBytes)).not.toThrow();
      })
    );
  });
});
