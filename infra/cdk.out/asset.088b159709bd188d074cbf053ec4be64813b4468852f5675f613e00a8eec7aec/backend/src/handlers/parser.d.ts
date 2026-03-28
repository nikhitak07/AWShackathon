/**
 * Parser — converts raw extracted text into a structured Checklist.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 11.1, 11.2
 */
import type { Checklist } from "@shared/types";
export declare class ParseError extends Error {
    constructor(message: string);
}
/**
 * Parses raw extracted text into a structured Checklist.
 * Throws ParseError if no items can be found.
 */
export declare function parseText(rawText: string, userId: string): Checklist;
/**
 * Serializes a Checklist to a canonical JSON string.
 */
export declare function formatChecklist(checklist: Checklist): string;
/**
 * Deserializes a canonical JSON string back to a Checklist.
 * Throws ParseError if the JSON is invalid or missing required fields.
 */
export declare function parseChecklist(json: string): Checklist;
import type { APIGatewayProxyHandler } from "aws-lambda";
export declare const parseHandler: APIGatewayProxyHandler;
