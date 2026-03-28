# Requirements Document

## Introduction

A web application that allows patients or caregivers to upload photos of hospital discharge papers. The application uses AWS AI services (Amazon Textract) to extract text from the uploaded images, then processes the extracted content to automatically generate a structured checklist of daily activities, medications, follow-up appointments, and other actionable items. The goal is to make discharge instructions more accessible and actionable for patients recovering at home.

## Glossary

- **System**: The discharge checklist web application
- **User**: A patient or caregiver using the application
- **Discharge_Paper**: A hospital-issued document containing post-discharge instructions, medications, activity restrictions, and follow-up care details
- **Textract**: Amazon Textract, the AWS AI service used to extract text from uploaded images
- **Checklist**: A structured, categorized list of actionable items derived from the discharge paper content
- **Checklist_Item**: A single actionable task or reminder within the Checklist
- **Uploader**: The component responsible for accepting and validating image uploads
- **Extractor**: The component that sends images to Textract and receives extracted text
- **Parser**: The component that processes extracted text into structured Checklist data
- **Pretty_Printer**: The component that formats Checklist data for display in the UI
- **Auth_Service**: The component responsible for user authentication and session management, backed by Amazon Cognito
- **Audit_Log**: An immutable, append-only record of security-relevant events within the System
- **PHI**: Protected Health Information as defined under HIPAA, including any data derived from discharge papers
- **Category_Icon**: A visual icon associated with a Checklist category (e.g., pill icon for Medications, calendar icon for Appointments, warning icon for Warning Signs)
- **Priority_Level**: A classification assigned to a Checklist_Item indicating its urgency, either High or Routine
- **Risk_Item**: A Checklist_Item with a Priority_Level of High, typically involving conditions that require immediate medical attention (e.g., fever thresholds, chest pain)
- **AI_Assistant**: The conversational component powered by Amazon Bedrock that answers User questions about the Checklist and discharge instructions in plain language
- **Bedrock**: Amazon Bedrock, the AWS AI service used to power the AI_Assistant

## Requirements

### Requirement 1: Image Upload

**User Story:** As a User, I want to upload photos of my discharge papers, so that the system can read and process the instructions for me.

#### Acceptance Criteria

1. THE Uploader SHALL accept image files in JPEG, PNG, and PDF formats.
2. WHEN a User selects a file for upload, THE Uploader SHALL validate that the file format is JPEG, PNG, or PDF before proceeding.
3. IF a User selects a file that is not JPEG, PNG, or PDF, THEN THE Uploader SHALL display an error message specifying the accepted formats.
4. THE Uploader SHALL accept image files up to 10 MB in size.
5. IF a User selects a file exceeding 10 MB, THEN THE Uploader SHALL display an error message stating the maximum allowed file size.
6. WHEN a valid file is selected, THE Uploader SHALL display a preview of the uploaded image before processing begins.
7. THE Uploader SHALL allow a User to upload up to 10 images per session to support multi-page discharge documents.

### Requirement 2: Text Extraction

**User Story:** As a User, I want the system to automatically read the text from my uploaded discharge paper images, so that I do not have to manually transcribe the content.

#### Acceptance Criteria

1. WHEN a User submits uploaded images for processing, THE Extractor SHALL send each image to Amazon Textract for text extraction.
2. WHEN Amazon Textract returns extracted text, THE Extractor SHALL pass the raw text to the Parser.
3. IF Amazon Textract returns an error for an image, THEN THE Extractor SHALL display an error message to the User indicating that text extraction failed for that image.
4. WHILE text extraction is in progress, THE System SHALL display a loading indicator to the User.
5. THE Extractor SHALL complete text extraction for a single image within 30 seconds under normal operating conditions.

### Requirement 3: Checklist Generation

**User Story:** As a User, I want the extracted discharge instructions to be automatically organized into a checklist, so that I can easily track and complete my recovery tasks.

#### Acceptance Criteria

1. WHEN the Parser receives extracted text, THE Parser SHALL identify and categorize actionable items into the following categories: Medications, Daily Activities, Follow-up Appointments, Dietary Restrictions, and Warning Signs.
2. WHEN the Parser identifies a Checklist_Item, THE Parser SHALL assign it to exactly one category.
3. IF the Parser cannot identify any actionable items in the extracted text, THEN THE Parser SHALL notify the User that no checklist items were found and suggest reviewing the uploaded image quality.
4. THE Parser SHALL produce a Checklist containing at least all Checklist_Items explicitly stated in the extracted text.
5. FOR ALL valid extracted text inputs, parsing then formatting then parsing SHALL produce an equivalent Checklist (round-trip property).

### Requirement 4: Checklist Display and Editing

**User Story:** As a User, I want to view and edit my generated checklist in a clear, organized format, so that I can customize it to match my actual recovery needs and easily track my progress.

#### Acceptance Criteria

1. WHEN a Checklist is generated, THE Pretty_Printer SHALL render each category as a distinct section with a visible heading.
2. THE Pretty_Printer SHALL render each Checklist_Item as a checkbox that the User can mark as complete.
3. WHEN a User marks a Checklist_Item as complete, THE System SHALL visually distinguish the completed item from incomplete items.
4. THE Pretty_Printer SHALL display Checklist_Items in the order they were identified within each category.
5. WHERE a Checklist_Item includes a date or time, THE Pretty_Printer SHALL display that date or time alongside the item.
6. THE System SHALL provide a mechanism for the User to add a new Checklist_Item to any existing category.
7. WHEN a User adds a Checklist_Item, THE System SHALL append the new item to the selected category and persist the change.
8. THE System SHALL provide a mechanism for the User to modify the text of any existing Checklist_Item.
9. WHEN a User modifies a Checklist_Item, THE System SHALL save the updated text and display the revised item in place.
10. THE System SHALL provide a mechanism for the User to delete any existing Checklist_Item.
11. WHEN a User deletes a Checklist_Item, THE System SHALL remove the item from the Checklist and persist the change.
12. IF a User deletes all Checklist_Items within a category, THEN THE System SHALL remove that category from the displayed Checklist.

### Requirement 5: Checklist Persistence

**User Story:** As a User, I want my checklist to be saved, so that I can return to it later without re-uploading my discharge papers.

#### Acceptance Criteria

1. WHEN a Checklist is generated, THE System SHALL save the Checklist to persistent storage associated with the User's session.
2. WHEN a User returns to the application within 30 days of generating a Checklist, THE System SHALL restore and display the saved Checklist.
3. IF persistent storage is unavailable, THEN THE System SHALL notify the User that the Checklist cannot be saved and display the Checklist for the current session only.
4. THE System SHALL allow a User to delete a saved Checklist.

### Requirement 6: Checklist Export

**User Story:** As a User, I want to export my checklist, so that I can share it with a caregiver or print it for reference.

#### Acceptance Criteria

1. THE System SHALL provide a mechanism for the User to export the Checklist as a PDF document.
2. WHEN a User requests a PDF export, THE Pretty_Printer SHALL generate a PDF containing all Checklist categories and items, including completion status.
3. THE System SHALL provide a mechanism for the User to share the Checklist via a unique URL.
4. WHEN a User accesses a shared Checklist URL, THE System SHALL display the Checklist in read-only mode.

### Requirement 7: User Authentication

**User Story:** As a User, I want to log in to the application with a secure account, so that my medical checklist data is private and accessible only to me.

#### Acceptance Criteria

1. THE Auth_Service SHALL require a User to authenticate before accessing any feature that processes or displays PHI.
2. WHEN a User provides valid credentials, THE Auth_Service SHALL issue a session token with an expiry of no more than 8 hours.
3. WHEN a session token expires, THE Auth_Service SHALL redirect the User to the login page and invalidate the expired token.
4. IF a User provides invalid credentials, THEN THE Auth_Service SHALL return a generic authentication failure message without revealing whether the username or password was incorrect.
5. THE Auth_Service SHALL enforce a minimum password length of 12 characters, requiring at least one uppercase letter, one lowercase letter, one digit, and one special character.
6. IF a User fails authentication 5 consecutive times within 15 minutes, THEN THE Auth_Service SHALL lock the account and notify the User via their registered email address.
7. THE Auth_Service SHALL support multi-factor authentication using a time-based one-time password (TOTP).
8. WHEN a User logs out, THE Auth_Service SHALL immediately invalidate the User's session token.

### Requirement 8: HIPAA Compliance

**User Story:** As a User, I want my protected health information handled in accordance with HIPAA, so that my medical data is protected by legally required safeguards.

#### Acceptance Criteria

1. THE System SHALL encrypt all PHI at rest using AES-256 encryption.
2. THE System SHALL transmit all PHI exclusively over TLS 1.2 or higher.
3. THE System SHALL record an Audit_Log entry for each of the following events: User login, User logout, image upload, Checklist generation, Checklist view, Checklist edit, Checklist deletion, and Checklist export.
4. WHEN an Audit_Log entry is created, THE System SHALL record the User identifier, event type, timestamp, and source IP address.
5. THE System SHALL retain Audit_Log entries for a minimum of 6 years in accordance with HIPAA retention requirements.
6. THE System SHALL restrict each User's access to only the PHI associated with that User's account (minimum necessary access principle).
7. THE System SHALL provide a mechanism for an administrator to export Audit_Log entries for compliance review.
8. IF an unauthorized access attempt to PHI is detected, THEN THE System SHALL record the attempt in the Audit_Log and alert an administrator within 1 hour.
9. THE System SHALL delete all PHI associated with a User's account within 30 days of an account deletion request.

### Requirement 9: Security and Privacy

**User Story:** As a User, I want my medical discharge information to be handled securely, so that my private health data is protected.

#### Acceptance Criteria

1. THE System SHALL transmit all uploaded images and extracted text over HTTPS.
2. THE System SHALL delete uploaded images from temporary storage within 24 hours of processing.
3. THE System SHALL restrict access to a User's saved Checklists to that authenticated User only.
4. THE System SHALL not store raw extracted text beyond the duration of the active processing session.
