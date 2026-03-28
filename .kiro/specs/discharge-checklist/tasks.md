# Implementation Plan: Discharge Checklist (MVP)

## Overview

Core foundational implementation covering infrastructure, auth, image upload, AI processing, and checklist display/persistence. Advanced features (PDF export, shareable URLs, AI chat, audit admin export, priority highlighting, visual icons) are deferred.

## Tasks

- [ ] 1. Set up project structure and AWS infrastructure
  - Scaffold a monorepo with `frontend/` (React + Vite + TypeScript) and `backend/` (AWS CDK stack)
  - Define CDK stacks for: S3 upload bucket (SSE-KMS, 24h lifecycle), DynamoDB `discharge-checklists` table (SSE-KMS, TTL attribute), Cognito User Pool (password policy, MFA TOTP), API Gateway REST API, CloudWatch log group `/discharge-checklist/audit` (2192-day retention), KMS customer-managed key
  - Wire IAM roles and resource policies (deny non-HTTPS on S3, least-privilege Lambda execution roles)
  - _Requirements: 7.1, 8.1, 8.2, 8.5, 9.1_

- [ ] 2. Implement authentication
  - [ ] 2.1 Configure Cognito User Pool in CDK with password policy (12 chars, upper/lower/digit/special), TOTP MFA enforced, 8-hour access token expiry, account lockout Lambda trigger (5 failures / 15 min → lock + email)
    - _Requirements: 7.2, 7.3, 7.5, 7.6, 7.7_
  - [ ] 2.2 arge-uploads-{accountId}`: 24-hour lifecycle delete rule
    - `discharge-checklists-export-{accountId}`: 7-day lifecycle delete rule
    - _Requirements: 8.1, 9.1, 9.2_
  - [ ] 2.2 Define DynamoDB `discharge-checklists` table
    - Partition key `PK = USER#{userId}`, sort key `SK = CHECKLIST#{checklistId}`, TTL on `ttl` attribute, SSE-KMS, GSI on `shareToken`
    - _Requirements: 5.1, 5.2, 8.1, 8.6_
  - [ ] 2.3 Define CloudWatch log group `/discharge-checklist/audit`
    - Retention 2192 days (6 years), subscription filter exporting to S3 Glacier
    - _Requirements: 8.3, 8.5_
  - [ ] 2.4 Define KMS customer-managed key and key policies
    - Attach key to S3 buckets and DynamoDB table
    - _Requirements: 8.1_
  - [ ] 2.5 Define API Gateway REST API with Cognito authorizer and TLS 1.2+ enforcement
    - Routes: POST /upload-url, GET /checklist/{id}, PATCH /checklist/{id}, DELETE /checklist/{id}, POST /checklist/{id}/export, POST /checklist/{id}/share, GET /shared/{token}, GET /admin/audit
    - _Requirements: 7.1, 8.2_
  - [ ] 2.6 Define Amazon Cognito User Pool
    - Password policy (min 12 chars, upper/lower/digit/special), TOTP MFA enforced, 8-hour access token expiry, account lockout Lambda trigger
    - _Requirements: 7.2, 7.3, 7.5, 7.6, 7.7_

- [ ] 3. Auth Lambda trigger — account lockout
  - Implement a Cognito `PreAuthentication` Lambda trigger that counts consecutive failed attempts per user within a 15-minute window (stored in DynamoDB or ElastiCache), locks the account after 5 failures, and sends an email notification via Cognito
  - _Requirements: 7.6_

- [ ] 4. `getUploadUrl` Lambda function
  - [ ] 4.1 Implement the function
    - Validate Cognito JWT from Authorization header
    - Validate `contentType` is `image/jpeg`, `image/png`, or `application/pdf` and `fileSizeBytes` ≤ 10,485,760
    - Generate a UUID `uploadId`, create an S3 presigned PUT URL keyed as `{userId}/{uploadId}/{filename}` expiring in 5 minutes
    - Write `IMAGE_UPLOAD` audit log entry to CloudWatch
    - Return `UploadUrlResponse`
    - _Requirements: 1.1, 1.2, 1.4, 8.3, 8.4, 9.1_
  - [ ]* 4.2 Write property test for upload URL validation
    - **Property 1: Any file with contentType outside the accepted set or fileSizeBytes > 10,485,760 is always rejected**
    - **Validates: Requirements 1.2, 1.4**

- [ ] 5. `processDocument` Lambda function
  - [ ] 5.1 Implement Textract OCR step
    - Triggered by S3 `ObjectCreated` event on the uploads bucket
    - Call `textract.detectDocumentText`, concatenate `LINE` blocks into `rawText`, compute average confidence
    - _Requirements: 2.1, 2.2, 2.3_
  - [ ] 5.2 Implement Bedrock parsing step
    - Send `rawText` to Amazon Bedrock (Claude) with a structured prompt instructing it to categorize items into the five categories and assign `PriorityLevel` (`High` for fever thresholds, chest pain, difficulty breathing, uncontrolled bleeding; `Routine` otherwise)
    - Parse the Bedrock JSON response into `ParsedChecklist`
    - If no items found, set a `noItemsFound` flag on the result
    - _Requirements: 3.1, 3.2, 3.3, 11.1, 11.2_
  - [ ] 5.3 Persist checklist to DynamoDB
    - Write `ParsedChecklist` with `ttl = createdAt + 30 days`, `PK = USER#{userId}`, `SK = CHECKLIST#{checklistId}`
    - Write `CHECKLIST_GENERATED` audit log entry
    - _Requirements: 5.1, 8.3, 8.4_
  - [ ]* 5.4 Write property test for checklist round-trip consistency
    - **Property 2: For all valid `ParsedChecklist` values, serializing to DynamoDB format then deserializing produces an equivalent checklist**
    - **Validates: Requirements 3.5, 5.1**
  - [ ]* 5.5 Write property test for priority assignment
    - **Property 3: Any item whose text contains a known risk keyword (fever, chest pain, difficulty breathing, uncontrolled bleeding) is always assigned PriorityLevel High**
    - **Validates: Requirements 11.1, 11.2**

- [ ] 6. `getChecklist` Lambda function
  - Validate JWT and extract `userId`
  - Query DynamoDB `PK = USER#{userId}`, `SK = CHECKLIST#{checklistId}`; return 403 if `userId` does not match
  - Write `CHECKLIST_VIEWED` audit log entry
  - _Requirements: 5.2, 8.3, 8.4, 8.6, 9.3_

- [ ] 7. `updateChecklist` Lambda function
  - [ ] 7.1 Implement add/edit/delete item mutations
    - Validate ownership, apply the mutation (add appends to category, edit updates `text`/`priority`, delete removes item; if last item in category, remove category)
    - Default `PriorityLevel` to `Routine` for user-added items unless explicitly set to `High`
    - Write `CHECKLIST_EDITED` audit log entry
    - _Requirements: 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 8.3, 11.6, 11.7, 11.8_
  - [ ]* 7.2 Write property test for checklist mutation invariants
    - **Property 4: After any sequence of add/edit/delete mutations, items within each category are ordered with High priority items before Routine items**
    - **Validates: Requirements 11.3, 11.8**

- [ ] 8. `deleteChecklist` Lambda function
  - Validate ownership, delete DynamoDB record, write `CHECKLIST_DELETED` audit log entry
  - _Requirements: 5.4, 8.3, 8.4_

- [ ] 9. `exportPdf` Lambda function
  - Fetch checklist from DynamoDB (ownership check), generate PDF using `pdfkit` with all categories, items, completion status, and priority indicators
  - Upload PDF to `discharge-checklists-export-{accountId}` S3 bucket, return a presigned GET URL expiring in 1 hour
  - Write `CHECKLIST_EXPORTED` audit log entry
  - _Requirements: 6.1, 6.2, 8.3, 8.4_

- [ ] 10. `shareChecklist` and `getSharedChecklist` Lambda functions
  - `shareChecklist`: generate a UUID share token, store it on the DynamoDB record with a `shareTokenExpiry`, return the shareable URL
  - `getSharedChecklist`: look up checklist via GSI on `shareToken`, validate expiry, return read-only checklist (no auth required, no PHI mutation)
  - _Requirements: 6.3, 6.4_

- [ ] 11. `exportAuditLog` Lambda function (admin)
  - Validate that the caller has an admin Cognito group claim
  - Stream CloudWatch log events from `/discharge-checklist/audit` log group for a requested date range
  - _Requirements: 8.7_

- [ ] 12. Unauthorized access detection
  - Add middleware/wrapper to all Lambda functions that catches ownership-check failures, writes an `UNAUTHORIZED_ACCESS_ATTEMPT` audit log entry, and triggers an SNS alert to administrators within 1 hour
  - _Requirements: 8.8_

- [ ] 13. Checkpoint — backend unit tests pass
  - Ensure all Lambda unit tests pass, audit log entries are written correctly, and DynamoDB access patterns are verified. Ask the user if questions arise.

- [ ] 14. Frontend — authentication shell
  - [ ] 14.1 Implement Cognito-backed auth flow
    - Integrate AWS Amplify Auth (or `amazon-cognito-identity-js`) for sign-in, sign-out, TOTP MFA enrollment, and session token refresh
    - Implement `AuthGuard` component that redirects unauthenticated users to the login page
    - On logout, call `globalSignOut` to invalidate all tokens
    - _Requirements: 7.1, 7.3, 7.4, 7.7, 7.8_
  - [ ]* 14.2 Write unit tests for AuthGuard
    - Test redirect behavior for unauthenticated users
    - Test that authenticated users can access protected routes
    - _Requirements: 7.1, 7.3_

- [ ] 15. Frontend — `Uploader` component
  - [ ] 15.1 Implement drag-and-drop file picker
    - Validate file format (JPEG/PNG/PDF) and size (≤ 10 MB) client-side before requesting a presigned URL
    - Display format/size error messages for invalid files
    - Show image preview after a valid file is selected
    - Allow up to 10 files per session
    - Call `getUploadUrl` API, then PUT the file directly to the presigned S3 URL
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  - [ ]* 15.2 Write property test for client-side file validation
    - **Property 5: For all file inputs, any file with an unsupported MIME type or size > 10 MB is always rejected before an API call is made**
    - **Validates: Requirements 1.2, 1.4**

- [ ] 16. Frontend — `ProcessingStatus` component
  - Poll the job status endpoint after upload, display a loading indicator while extraction is in progress
  - On completion, navigate to `ChecklistView`; on error, display the extraction failure message
  - _Requirements: 2.3, 2.4_

- [ ] 17. Frontend — `ChecklistView` component
  - [ ] 17.1 Implement category rendering with visual cues
    - Render each category as a distinct section with heading
    - Display `Category_Icon` (pill, calendar, warning, fork-and-knife, activity) in its assigned distinct color at ≥ 24×24 px alongside each heading
    - Display a default icon for any dynamically added category
    - _Requirements: 4.1, 10.1, 10.2, 10.3, 10.4, 10.5_
  - [ ] 17.2 Implement item rendering with priority highlighting
    - Render `Risk_Items` (High priority) before Routine items within each category
    - Style Risk_Items with a red/amber color indicator and "High Priority" label
    - Render Routine items without a priority indicator
    - Display `dateTime` alongside items where present
    - _Requirements: 4.4, 4.5, 11.3, 11.4, 11.5_
  - [ ] 17.3 Implement checklist item interactions
    - Render each item as a checkbox; visually distinguish completed items
    - Provide add, edit, delete controls for each item and category
    - Provide a priority toggle (High / Routine) on each item; default new user-added items to Routine
    - On any mutation, call `updateChecklist` API and re-render with updated order
    - _Requirements: 4.2, 4.3, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 11.6, 11.7, 11.8_
  - [ ]* 17.4 Write unit tests for ChecklistView rendering
    - Test that High priority items always appear before Routine items
    - Test that completing an item applies the correct visual style
    - Test that deleting the last item in a category removes the category section
    - _Requirements: 4.3, 4.12, 11.3_

- [ ] 18. Frontend — `ExportPanel` component
  - Trigger `exportPdf` API call and open the returned presigned URL for download
  - Trigger `shareChecklist` API call and display the shareable URL for copying
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 19. Frontend — AI Assistant chat interface
  - [ ] 19.1 Implement chat UI
    - Render only for authenticated users; hide/disable for unauthenticated sessions
    - Accept natural language input, send question + current checklist content to the AI assistant API endpoint
    - Display Bedrock response within the UI; append a disclaimer on every response: "This information is not a substitute for professional medical advice."
    - Show a temporary unavailability message if Bedrock returns an error
    - Maintain conversation context (message history) for the duration of the active session
    - _Requirements: 12.1, 12.3, 12.5, 12.6, 12.9, 12.10_
  - [ ] 19.2 Implement `chatAssistant` Lambda function
    - Validate JWT, retrieve current checklist from DynamoDB, send question + checklist content to Bedrock (Claude); do not include any PHI beyond the user's own checklist
    - Return Bedrock response within 10 seconds; write `AI_ASSISTANT_INVOKED` audit log entry (userId, timestamp, sourceIp — no question/response content)
    - _Requirements: 12.2, 12.4, 12.7, 12.8_
  - [ ]* 19.3 Write unit tests for chatAssistant Lambda
    - Test that PHI beyond the user's own checklist is never included in the Bedrock payload
    - Test that audit log entries do not contain question or response content
    - _Requirements: 12.7, 12.8_

- [ ] 20. PHI deletion on account removal
  - Implement a Cognito `PostConfirmation` or account-deletion Lambda trigger that schedules deletion of all DynamoDB records and S3 objects for the user within 30 days
  - _Requirements: 8.9_

- [ ] 21. Checkpoint — full integration tests pass
  - Ensure all unit and integration tests pass end-to-end (upload → extract → parse → display → edit → export). Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases
