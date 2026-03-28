/**
 * Auth_Service — backed by Amazon Cognito User Pools.
 *
 * Implements login, logout, and refreshSession.
 * Account lockout (5 failed attempts / 15 min) is enforced via Cognito
 * Pre-Authentication and Post-Authentication Lambda triggers defined in
 * lockoutTriggers.ts.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
 */
export interface AuthTokens {
    /** JWT access token, max 8h expiry (Req 7.2) */
    accessToken: string;
    refreshToken: string;
    idToken: string;
}
export interface LoginRequest {
    username: string;
    password: string;
    /** TOTP code — required when MFA challenge is returned (Req 7.7) */
    totpCode?: string;
}
/**
 * Authenticates a user against Cognito.
 *
 * - Returns generic error on invalid credentials (Req 7.4)
 * - Handles SOFTWARE_TOKEN_MFA challenge for TOTP (Req 7.7)
 * - Account lockout is enforced by the Pre-Authentication Lambda trigger (Req 7.6)
 */
export declare function login(req: LoginRequest): Promise<AuthTokens>;
/**
 * Invalidates all tokens for the user's current session (Req 7.8).
 */
export declare function logout(accessToken: string): Promise<void>;
/**
 * Exchanges a refresh token for a new set of tokens (Req 7.2, 7.3).
 * Throws if the refresh token is expired or revoked.
 */
export declare function refreshSession(refreshToken: string): Promise<AuthTokens>;
