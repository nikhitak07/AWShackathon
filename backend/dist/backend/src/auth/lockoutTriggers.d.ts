/**
 * Cognito Lambda triggers for account lockout enforcement.
 *
 * Pre-Authentication trigger:
 *   - Tracks failed login attempts in DynamoDB (pk: `LOCKOUT#{username}`)
 *   - If count >= 5 within 15 minutes, throws a custom error and sends an SES email
 *
 * Post-Authentication trigger:
 *   - Resets the failed-attempt counter on successful login
 *
 * Requirements: 7.6
 */
import type { PreAuthenticationTriggerEvent, PostAuthenticationTriggerEvent } from "aws-lambda";
export declare function preAuthHandler(event: PreAuthenticationTriggerEvent): Promise<PreAuthenticationTriggerEvent>;
export declare function postAuthHandler(event: PostAuthenticationTriggerEvent): Promise<PostAuthenticationTriggerEvent>;
