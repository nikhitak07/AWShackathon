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

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  RespondToAuthChallengeCommand,
  AuthFlowType,
  ChallengeNameType,
} from "@aws-sdk/client-cognito-identity-provider";

const cognitoClient = new CognitoIdentityProviderClient({});

const CLIENT_ID = process.env.COGNITO_CLIENT_ID ?? "";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

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
export async function login(req: LoginRequest): Promise<AuthTokens> {
  try {
    const initiateResult = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: req.username,
          PASSWORD: req.password,
        },
      })
    );

    // Handle TOTP MFA challenge
    if (
      initiateResult.ChallengeName === ChallengeNameType.SOFTWARE_TOKEN_MFA
    ) {
      if (!req.totpCode) {
        throw new Error("MFA_REQUIRED");
      }

      const mfaResult = await cognitoClient.send(
        new RespondToAuthChallengeCommand({
          ClientId: CLIENT_ID,
          ChallengeName: ChallengeNameType.SOFTWARE_TOKEN_MFA,
          Session: initiateResult.Session,
          ChallengeResponses: {
            USERNAME: req.username,
            SOFTWARE_TOKEN_MFA_CODE: req.totpCode,
          },
        })
      );

      return extractTokens(mfaResult.AuthenticationResult);
    }

    return extractTokens(initiateResult.AuthenticationResult);
  } catch (err: unknown) {
    // Re-throw MFA_REQUIRED as-is so callers can prompt for TOTP
    if (err instanceof Error && err.message === "MFA_REQUIRED") {
      throw err;
    }

    // Lockout error from Pre-Authentication trigger — propagate with a
    // user-friendly message but do not reveal username/password distinction
    if (
      err instanceof Error &&
      err.message.includes("AccountLocked")
    ) {
      throw new Error(
        "Your account has been locked due to too many failed login attempts. Please check your email for instructions."
      );
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
export async function logout(accessToken: string): Promise<void> {
  try {
    await cognitoClient.send(
      new GlobalSignOutCommand({ AccessToken: accessToken })
    );
  } catch {
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
export async function refreshSession(
  refreshToken: string
): Promise<AuthTokens> {
  try {
    const result = await cognitoClient.send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      })
    );

    return extractTokens(result.AuthenticationResult);
  } catch {
    throw new Error("Session expired. Please log in again.");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTokens(
  result:
    | {
        AccessToken?: string;
        RefreshToken?: string;
        IdToken?: string;
      }
    | undefined
): AuthTokens {
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
