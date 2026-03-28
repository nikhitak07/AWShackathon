# Implementation Plan: Discharge Checklist

## Overview

Implement a HIPAA-compliant serverless web application that converts hospital discharge papers into structured, interactive checklists. The implementation follows the component architecture defined in the design: Uploader, Extractor, Parser, Pretty_Printer, Auth_Service, AI_Assistant, and Audit_Log.

## Tasks

- [x] 1. Project scaffolding and shared types
  - Create the React + TypeScript frontend project (Vite or CRA) and Lambda project structure
  - Define all shared TypeScript interfaces: `ChecklistItem`, `Checklist`, `Category`, `PriorityLevel`, `AuditLogEntry`, `AuditEventType`, `UploadRequest`, `UploadResponse`, `ExtractionRequest`, `ExtractionResult`, `AssistantRequest`, `AssistantResponse`, `Message`
  - Set up DynamoDB table definitions (`checklists`, `audit_log`) and S3 bucket configurations (`discharge-images-temp`, `discharge-exports`) as IaC (CDK or CloudFormation)
  - Configure TLS-only API Gateway and CloudFront distribution
  - _Requirements: 8.1, 8.2, 9.1_

- [ ] 2. Auth_Service — Cognito integration
  - [x] 2.1 Implement `login`, `logout`, and `refreshSession` functions backed by Amazon Cognito User Pools
    - Enforce password policy: min 12 chars, upper + lower + digit + special character
    - Enable TOTP MFA enforcement in Cognito configuration
    - Set session token expiry to 8 hours
    - Return generic error message on invalid credentials (no username/password distinction)
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.7_
  - [~] 2.2 Implement account lockout after 5 failed attempts within 15 minutes with email notification
    - _Requirements: 7.6_
  - [~] 2.3 Implement session expiry redirect — expired JWT redirects user to login and invalidates token
    - _Requirements: 7.3, 7.8_
  - [ ]* 2.4 Write unit tests for Auth_Service
    - Test generic error on bad credentials
    - Test lockout trigger at 5th consecutive failure
    - Test session token expiry enforcement
    - _Requirements: 7.2, 7.4, 7.6_

- [ ] 3. Audit_Log — append-only DynamoDB writes
  - [~] 3.1 Implement `writeAuditEntry(entry: AuditLogEntry): Promise<void>` that writes to the `audit_log` DynamoDB table
    - IAM policy must deny `DeleteItem` and `UpdateItem` for the application role
    - Record `userId`, `eventType`, `timestamp`, `sourceIp` on every call
    - _Requirements: 8.3, 8.4_
  - [~] 3.2 Instrument all required event types: LOGIN, LOGOUT, IMAGE_UPLOAD, CHECKLIST_GENERATED, CHECKLIST_VIEW, CHECKLIST_EDIT, CHECKLIST_DELETED, CHECKLIST_EXPORT, AI_ASSISTANT_INVOKED, UNAUTHORIZED_ACCESS_ATTEMPT
    - _Requirements: 8.3, 8.8_
  - [~] 3.3 Implement admin export Lambda that streams `audit_log` entries to S3
    - Disable DynamoDB TTL on `audit_log` table; entries retained ≥6 years
    - _Requirements: 8.5, 8.7_
  - [ ]* 3.4 Write unit tests for Audit_Log
    - Test that all required event types produce a correctly shaped entry
    - Test that update/delete operations are rejected by IAM policy (integration-level)
    - _Requirements: 8.3, 8.4, 8.5_

- [~] 4. Checkpoint — Auth and Audit baseline
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Uploader — file validation and pre-signed URL
  - [~] 5.1 Implement `validateFile(file: File): void`
    - Accept only `image/jpeg`, `image/png`, `application/pdf`; throw `UploadValidationError` on invalid format
    - Reject files exceeding 10 MB; throw `UploadValidationError` with size message
    - Enforce max 10 files per session
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_
  - [ ]* 5.2 Write property test for `validateFile`
    - **Property 1: Any file with an accepted MIME type and size ≤10 MB must pass validation**
    - **Validates: Requirements 1.1, 1.4**
  - [~] 5.3 Implement `getUploadUrl(req: UploadRequest): Promise<UploadResponse>` Lambda — generates pre-signed S3 PUT URL targeting `discharge-images-temp` bucket (SSE-S3, 24h lifecycle rule)
    - _Requirements: 9.1, 9.2_
  - [~] 5.4 Implement image preview display in the React UI after a valid file is selected
    - _Requirements: 1.6_
  - [ ]* 5.5 Write unit tests for Uploader
    - Test rejection of unsupported MIME types with correct error message
    - Test rejection of files >10 MB with correct error message
    - Test acceptance of all three valid formats at boundary sizes
    - _Requirements: 1.2, 1.3, 1.5_

- [ ] 6. Extractor — Textract Lambda
  - [~] 6.1 Implement `extractText(req: ExtractionRequest): Promise<ExtractionResult>` Lambda
    - Call `DetectDocumentText` for images, `AnalyzeDocument` for PDFs
    - Enforce 30-second timeout; throw `ExtractionError` on Textract error
    - Pass `rawText` to Parser on success; never persist raw text
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 9.4_
  - [~] 6.2 Display loading indicator in the UI while extraction is in progress; display error message on `ExtractionError`
    - _Requirements: 2.3, 2.4_
  - [ ]* 6.3 Write unit tests for Extractor
    - Test that `ExtractionError` is thrown and user-facing error displayed on Textract failure
    - Test that raw text is not persisted after extraction
    - _Requirements: 2.3, 9.4_

- [ ] 7. Parser — text-to-checklist conversion
  - [~] 7.1 Implement `parseText(rawText: string, userId: string): Checklist`
    - Categorize items into Medications, DailyActivities, FollowUpAppointments, DietaryRestrictions, WarningSigns using keyword/pattern matching
    - Assign each item to exactly one category
    - Assign `PriorityLevel` of `High` for items matching risk patterns (fever, chest pain, difficulty breathing, uncontrolled bleeding); default to `Routine`
    - Throw `ParseError` if no items found; surface user-facing message suggesting image quality review
    - Parse ISO 8601 date/time when present in item text
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 11.1, 11.2_
  - [ ]* 7.2 Write property test for `parseText` — categorization completeness
    - **Property 2: Every item explicitly stated in the raw text appears in the output Checklist**
    - **Validates: Requirements 3.4**
  - [ ]* 7.3 Write property test for `parseText` — priority assignment
    - **Property 3: Any item containing a known risk keyword is assigned PriorityLevel High**
    - **Validates: Requirements 11.2**
  - [~] 7.4 Implement `formatChecklist(checklist: Checklist): string` and `parseChecklist(json: string): Checklist`
    - _Requirements: 3.5_
  - [ ]* 7.5 Write property test for round-trip consistency
    - **Property 4: `parseChecklist(formatChecklist(c))` produces a Checklist equivalent to `c` for all valid Checklists**
    - **Validates: Requirements 3.5**
  - [ ]* 7.6 Write unit tests for Parser
    - Test `ParseError` on empty/unrecognizable text
    - Test correct category assignment for representative items in each category
    - Test date/time extraction from item text
    - _Requirements: 3.1, 3.2, 3.3_

- [~] 8. Checkpoint — Core pipeline (Upload → Extract → Parse)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Checklist persistence — DynamoDB CRUD
  - [~] 9.1 Implement Lambda handlers for save, get, update, and delete checklist operations against the `checklists` DynamoDB table
    - Use `USER#{userId}` / `CHECKLIST#{checklistId}` key schema
    - Set 30-day TTL on checklist items
    - Enforce per-user access: Lambda must verify `userId` from JWT matches `pk` before any read/write
    - _Requirements: 5.1, 5.2, 5.4, 8.6, 9.3_
  - [~] 9.2 Surface storage-unavailable error in the UI when DynamoDB write fails
    - _Requirements: 5.3_
  - [ ]* 9.3 Write unit tests for checklist persistence
    - Test that a checklist saved by user A cannot be retrieved by user B
    - Test 30-day TTL is set correctly on save
    - Test storage-unavailable error path
    - _Requirements: 5.1, 5.2, 5.3, 9.3_

- [ ] 10. Pretty_Printer — checklist React component
  - [~] 10.1 Implement the `PrettyPrinter` React component
    - Render each category as a distinct section with heading and `Category_Icon` (≥24×24 px, unique color per category)
    - Assign correct icons: pill → Medications, calendar → FollowUpAppointments, warning → WarningSigns, fork-and-knife → DietaryRestrictions, activity → DailyActivities
    - Display `High` items before `Routine` items within each section
    - Render `High` items with red/amber indicator and "High Priority" label; render `Routine` items without indicator
    - Render completed items with strikethrough + muted color
    - Display date/time inline when present on an item
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 10.1, 10.2, 10.3, 10.5, 11.3, 11.4, 11.5_
  - [~] 10.2 Implement add, edit, delete, and priority-change interactions
    - Add item: append to selected category, default priority Routine, persist via API
    - Edit item: save updated text in place, persist via API
    - Delete item: remove item and remove category section if empty, persist via API
    - Priority change: reorder items within category to reflect new priority, persist via API
    - _Requirements: 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 11.6, 11.7, 11.8_
  - [~] 10.3 Implement default icon display for dynamically added categories
    - _Requirements: 10.4_
  - [ ]* 10.4 Write unit tests for Pretty_Printer
    - Test High items render before Routine items in the same category
    - Test completed item receives strikethrough style
    - Test empty category is removed from display after last item deleted
    - Test Category_Icons render at ≥24×24 px
    - _Requirements: 4.3, 4.12, 11.3, 10.5_

- [ ] 11. Checklist export and sharing
  - [~] 11.1 Implement PDF export Lambda — generate PDF from `Checklist` (all categories, items, completion status) and store in `discharge-exports` S3 bucket under per-user prefix; return pre-signed download URL
    - Write `CHECKLIST_EXPORT` audit log entry on invocation
    - _Requirements: 6.1, 6.2, 8.3_
  - [~] 11.2 Implement share-URL Lambda — create a `SHARE#{shareToken}` DynamoDB item referencing the source checklist; return unique URL
    - Shared checklist rendered in read-only mode (`readOnly: true` prop on `PrettyPrinter`)
    - _Requirements: 6.3, 6.4_
  - [ ]* 11.3 Write unit tests for export and sharing
    - Test PDF contains all items and completion status
    - Test shared URL renders checklist in read-only mode
    - _Requirements: 6.2, 6.4_

- [ ] 12. AI_Assistant — Bedrock chat
  - [~] 12.1 Implement `askAssistant(req: AssistantRequest): Promise<AssistantResponse>` Lambda
    - Send question + current user checklist (no raw PHI beyond checklist) to Amazon Bedrock
    - Maintain conversation history for the active session
    - Append disclaimer to every response
    - Respond within 10 seconds under normal conditions; surface unavailability message on Bedrock error
    - Write `AI_ASSISTANT_INVOKED` audit log entry (userId, timestamp, sourceIp only — no question/response content)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.10_
  - [~] 12.2 Implement AI_Assistant React chat component
    - Gate behind authentication check — hide/disable when user is unauthenticated
    - _Requirements: 12.9_
  - [ ]* 12.3 Write unit tests for AI_Assistant
    - Test disclaimer is always appended to responses
    - Test unavailability message shown on Bedrock error
    - Test component is not accessible when unauthenticated
    - Test audit log entry does not include question or response content
    - _Requirements: 12.5, 12.6, 12.8, 12.9_

- [ ] 13. HIPAA compliance wiring
  - [~] 13.1 Verify and enforce AES-256 encryption at rest for all DynamoDB tables and S3 buckets (AWS-managed KMS)
    - _Requirements: 8.1_
  - [~] 13.2 Enforce TLS 1.2+ on API Gateway and CloudFront; reject non-HTTPS requests
    - _Requirements: 8.2, 9.1_
  - [~] 13.3 Implement unauthorized access detection: if a request attempts to access another user's PHI, write `UNAUTHORIZED_ACCESS_ATTEMPT` audit log entry and return 403; trigger admin alert within 1 hour
    - _Requirements: 8.6, 8.8_
  - [~] 13.4 Implement account deletion flow — delete all PHI associated with the user within 30 days of deletion request
    - _Requirements: 8.9_
  - [ ]* 13.5 Write integration tests for HIPAA controls
    - Test cross-user PHI access returns 403 and writes audit entry
    - Test uploaded images are absent from temp bucket after 24 hours (lifecycle rule)
    - _Requirements: 8.6, 8.8, 9.2, 9.3_

- [~] 14. Final checkpoint — full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key pipeline boundaries
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases
