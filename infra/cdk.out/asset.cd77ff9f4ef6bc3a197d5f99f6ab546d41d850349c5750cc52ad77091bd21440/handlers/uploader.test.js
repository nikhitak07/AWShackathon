"use strict";
/**
 * Tests for the Uploader handler.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
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
// Mock AWS SDK modules before importing uploader (same pattern as extractor tests)
vitest_1.vi.mock("@aws-sdk/client-s3", () => ({
    S3Client: vitest_1.vi.fn().mockImplementation(() => ({})),
    PutObjectCommand: vitest_1.vi.fn().mockImplementation((input) => ({ input })),
}));
vitest_1.vi.mock("@aws-sdk/s3-request-presigner", () => ({
    getSignedUrl: vitest_1.vi.fn().mockResolvedValue("https://s3.example.com/presigned"),
}));
const uploader_1 = require("./uploader");
// ---------------------------------------------------------------------------
// Unit tests — Task 5.5
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("validateFile — rejection of unsupported MIME types", () => {
    const INVALID_TYPES = ["image/gif", "image/webp", "text/plain", "application/zip", "video/mp4"];
    for (const mimeType of INVALID_TYPES) {
        (0, vitest_1.it)(`rejects "${mimeType}" with correct error message`, () => {
            (0, vitest_1.expect)(() => (0, uploader_1.validateFile)(mimeType, 1024)).toThrow(uploader_1.UploadValidationError);
            (0, vitest_1.expect)(() => (0, uploader_1.validateFile)(mimeType, 1024)).toThrow(`Unsupported file type "${mimeType}". Only JPEG, PNG, and PDF files are accepted.`);
        });
    }
});
(0, vitest_1.describe)("validateFile — rejection of files over 10 MB", () => {
    (0, vitest_1.it)("rejects a file of exactly 10 MB + 1 byte", () => {
        (0, vitest_1.expect)(() => (0, uploader_1.validateFile)("image/jpeg", uploader_1.MAX_FILE_SIZE_BYTES + 1)).toThrow(uploader_1.UploadValidationError);
    });
    (0, vitest_1.it)("error message includes the actual size in MB", () => {
        const size = 11 * 1024 * 1024; // 11 MB
        (0, vitest_1.expect)(() => (0, uploader_1.validateFile)("image/jpeg", size)).toThrow("11.0 MB exceeds the 10 MB limit");
    });
    (0, vitest_1.it)("rejects a very large file", () => {
        (0, vitest_1.expect)(() => (0, uploader_1.validateFile)("application/pdf", 100 * 1024 * 1024)).toThrow(uploader_1.UploadValidationError);
    });
});
(0, vitest_1.describe)("validateFile — acceptance of valid formats at boundary sizes", () => {
    (0, vitest_1.it)("accepts image/jpeg at exactly 10 MB", () => {
        (0, vitest_1.expect)(() => (0, uploader_1.validateFile)("image/jpeg", uploader_1.MAX_FILE_SIZE_BYTES)).not.toThrow();
    });
    (0, vitest_1.it)("accepts image/png at exactly 10 MB", () => {
        (0, vitest_1.expect)(() => (0, uploader_1.validateFile)("image/png", uploader_1.MAX_FILE_SIZE_BYTES)).not.toThrow();
    });
    (0, vitest_1.it)("accepts application/pdf at exactly 10 MB", () => {
        (0, vitest_1.expect)(() => (0, uploader_1.validateFile)("application/pdf", uploader_1.MAX_FILE_SIZE_BYTES)).not.toThrow();
    });
    (0, vitest_1.it)("accepts image/jpeg at 1 byte", () => {
        (0, vitest_1.expect)(() => (0, uploader_1.validateFile)("image/jpeg", 1)).not.toThrow();
    });
    (0, vitest_1.it)("accepts image/png at 0 bytes", () => {
        (0, vitest_1.expect)(() => (0, uploader_1.validateFile)("image/png", 0)).not.toThrow();
    });
});
// ---------------------------------------------------------------------------
// Property test — Task 5.2
// Property 1: Any file with an accepted MIME type and size ≤ 10 MB must pass
// Requirements: 1.1, 1.4
// ---------------------------------------------------------------------------
(0, vitest_1.describe)("Property 1: valid MIME type + size ≤ 10 MB always passes validation", () => {
    (0, vitest_1.it)("never throws for accepted types within size limit", () => {
        const mimeArb = fc.constantFrom(...uploader_1.ACCEPTED_MIME_TYPES);
        const sizeArb = fc.integer({ min: 0, max: uploader_1.MAX_FILE_SIZE_BYTES });
        fc.assert(fc.property(mimeArb, sizeArb, (mimeType, sizeBytes) => {
            (0, vitest_1.expect)(() => (0, uploader_1.validateFile)(mimeType, sizeBytes)).not.toThrow();
        }));
    });
});
