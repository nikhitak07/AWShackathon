/**
 * Checklist persistence — DynamoDB CRUD Lambda handlers.
 *
 * Key schema:
 *   pk: USER#{userId}
 *   sk: CHECKLIST#{checklistId}
 *
 * - 30-day TTL on every item (Req 5.2)
 * - Per-user access enforcement: userId from JWT must match pk (Req 5.4, 8.6)
 *
 * Requirements: 5.1, 5.2, 5.4, 8.6, 9.3
 */
import type { APIGatewayProxyHandler } from "aws-lambda";
import type { Checklist } from "@shared/types";
export declare function makePk(userId: string): string;
export declare function makeSk(checklistId: string): string;
export declare function ttlInSeconds(days?: number): number;
export declare function saveChecklist(checklist: Checklist): Promise<void>;
export declare const saveHandler: APIGatewayProxyHandler;
export declare function getChecklist(userId: string, checklistId: string): Promise<Checklist | null>;
export declare const getHandler: APIGatewayProxyHandler;
export declare function updateChecklist(checklist: Checklist): Promise<void>;
export declare const updateHandler: APIGatewayProxyHandler;
export declare function deleteChecklist(userId: string, checklistId: string): Promise<void>;
export declare const deleteHandler: APIGatewayProxyHandler;
export declare function listChecklists(userId: string): Promise<Checklist[]>;
export declare const listHandler: APIGatewayProxyHandler;
