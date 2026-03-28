"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.logout = logout;
exports.refreshSession = refreshSession;
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
const cognitoClient = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({});
const CLIENT_ID = process.env.COGNITO_CLIENT_ID ?? "";
// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------
/**
 * Authenticates a user against Cognito.
 *
 * - Returns generic error on invalid credentials (Req 7.4)
 * - Handles SOFTWARE_TOKEN_MFA challenge for TOTP (Req 7.7)
 * - Account lockout is enforced by the Pre-Authentication Lambda trigger (Req 7.6)
 */
async function login(req) {
    try {
        const initiateResult = await cognitoClient.send(new client_cognito_identity_provider_1.InitiateAuthCommand({
            AuthFlow: client_cognito_identity_provider_1.AuthFlowType.USER_PASSWORD_AUTH,
            ClientId: CLIENT_ID,
            AuthParameters: {
                USERNAME: req.username,
                PASSWORD: req.password,
            },
        }));
        // Handle TOTP MFA challenge
        if (initiateResult.ChallengeName === client_cognito_identity_provider_1.ChallengeNameType.SOFTWARE_TOKEN_MFA) {
            if (!req.totpCode) {
                throw new Error("MFA_REQUIRED");
            }
            const mfaResult = await cognitoClient.send(new client_cognito_identity_provider_1.RespondToAuthChallengeCommand({
                ClientId: CLIENT_ID,
                ChallengeName: client_cognito_identity_provider_1.ChallengeNameType.SOFTWARE_TOKEN_MFA,
                Session: initiateResult.Session,
                ChallengeResponses: {
                    USERNAME: req.username,
                    SOFTWARE_TOKEN_MFA_CODE: req.totpCode,
                },
            }));
            return extractTokens(mfaResult.AuthenticationResult);
        }
        return extractTokens(initiateResult.AuthenticationResult);
    }
    catch (err) {
        // Re-throw MFA_REQUIRED as-is so callers can prompt for TOTP
        if (err instanceof Error && err.message === "MFA_REQUIRED") {
            throw err;
        }
        // Lockout error from Pre-Authentication trigger — propagate with a
        // user-friendly message but do not reveal username/password distinction
        if (err instanceof Error &&
            err.message.includes("AccountLocked")) {
            throw new Error("Your account has been locked due to too many failed login attempts. Please check your email for instructions.");
        }
        // Req 7.4: return a generic error — do not reveal whether username or
        // password was incorrect
        throw new Error("Invalid credentials. Please try again.");
    }
}
// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------
/**
 * Invalidates all tokens for the user's current session (Req 7.8).
 */
async function logout(accessToken) {
    try {
        await cognitoClient.send(new client_cognito_identity_provider_1.GlobalSignOutCommand({ AccessToken: accessToken }));
    }
    catch {
        // Swallow errors — if the token is already invalid the logout intent is met
    }
}
// ---------------------------------------------------------------------------
// refreshSession
// ---------------------------------------------------------------------------
/**
 * Exchanges a refresh token for a new set of tokens (Req 7.2, 7.3).
 * Throws if the refresh token is expired or revoked.
 */
async function refreshSession(refreshToken) {
    try {
        const result = await cognitoClient.send(new client_cognito_identity_provider_1.InitiateAuthCommand({
            AuthFlow: client_cognito_identity_provider_1.AuthFlowType.REFRESH_TOKEN_AUTH,
            ClientId: CLIENT_ID,
            AuthParameters: {
                REFRESH_TOKEN: refreshToken,
            },
        }));
        return extractTokens(result.AuthenticationResult);
    }
    catch {
        throw new Error("Session expired. Please log in again.");
    }
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function extractTokens(result) {
    if (!result?.AccessToken || !result?.IdToken) {
        throw new Error("Invalid credentials. Please try again.");
    }
    return {
        accessToken: result.AccessToken,
        // RefreshToken is not returned on MFA challenge responses — keep existing
        refreshToken: result.RefreshToken ?? "",
        idToken: result.IdToken,
    };
}
