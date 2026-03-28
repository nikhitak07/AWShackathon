/**
 * Shared TypeScript interfaces and types for the Discharge Checklist application.
 * Used by both the React frontend and Lambda backend.
 */
export type Category = "Medications" | "DailyActivities" | "FollowUpAppointments" | "DietaryRestrictions" | "WarningSigns";
export type PriorityLevel = "High" | "Routine";
export interface ChecklistItem {
    /** UUID */
    id: string;
    text: string;
    category: Category;
    priority: PriorityLevel;
    /** ISO 8601 date/time string, present when the item includes a date or time */
    dateTime?: string;
    completed: boolean;
}
export interface Checklist {
    /** UUID */
    id: string;
    userId: string;
    /** ISO 8601 */
    createdAt: string;
    /** ISO 8601 */
    updatedAt: string;
    items: ChecklistItem[];
}
export type AuditEventType = "LOGIN" | "LOGOUT" | "IMAGE_UPLOAD" | "CHECKLIST_GENERATED" | "CHECKLIST_VIEW" | "CHECKLIST_EDIT" | "CHECKLIST_DELETED" | "CHECKLIST_EXPORT" | "AI_ASSISTANT_INVOKED" | "UNAUTHORIZED_ACCESS_ATTEMPT";
export interface AuditLogEntry {
    /** UUID */
    entryId: string;
    userId: string;
    eventType: AuditEventType;
    /** ISO 8601 */
    timestamp: string;
    sourceIp: string;
}
export interface UploadRequest {
    file: File;
    sessionId: string;
}
export interface UploadResponse {
    /** S3 object key */
    uploadId: string;
    /** Pre-signed URL for image preview */
    previewUrl: string;
}
export interface ExtractionRequest {
    /** S3 object key */
    uploadId: string;
    userId: string;
}
export interface ExtractionResult {
    /** Concatenated text blocks from Textract */
    rawText: string;
    uploadId: string;
}
export interface Message {
    role: "user" | "assistant";
    content: string;
}
export interface AssistantRequest {
    sessionId: string;
    question: string;
    /** Current user checklist — only this is sent to Bedrock, no raw PHI */
    checklistContext: Checklist;
    conversationHistory: Message[];
}
export interface AssistantResponse {
    answer: string;
    /** Always appended to every response */
    disclaimer: string;
}
//# sourceMappingURL=types.d.ts.map