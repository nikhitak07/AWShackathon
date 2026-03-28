import React, { useState } from "react";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  AuthFlowType,
  ChallengeNameType,
} from "@aws-sdk/client-cognito-identity-provider";

const cognitoClient = new CognitoIdentityProviderClient({
  region: import.meta.env.VITE_AWS_REGION ?? "us-east-1",
});
const CLIENT_ID = import.meta.env.VITE_USER_POOL_CLIENT_ID ?? "";

interface Props {
  onLogin: (accessToken: string) => void;
}

type Step = "credentials" | "mfa" | "new_password" | "mfa_setup";

export const Login: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [session, setSession] = useState<string | undefined>();
  const [secretCode, setSecretCode] = useState("");
  const [setupTotp, setSetupTotp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await cognitoClient.send(new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: CLIENT_ID,
        AuthParameters: { USERNAME: username, PASSWORD: password },
      }));

      if (res.ChallengeName === ChallengeNameType.SOFTWARE_TOKEN_MFA) {
        setSession(res.Session);
        setStep("mfa");
      } else if (res.ChallengeName === ChallengeNameType.NEW_PASSWORD_REQUIRED) {
        setSession(res.Session);
        setStep("new_password");
      } else if ((res.ChallengeName as string) === "MFA_SETUP") {
        // Associate TOTP device
        setSession(res.Session);
        const assoc = await cognitoClient.send(new AssociateSoftwareTokenCommand({ Session: res.Session }));
        setSecretCode(assoc.SecretCode ?? "");
        setSession(assoc.Session);
        setStep("mfa_setup");
      } else if (res.AuthenticationResult?.AccessToken) {
        onLogin(res.AuthenticationResult.AccessToken);
      }
    } catch {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await cognitoClient.send(new RespondToAuthChallengeCommand({
        ClientId: CLIENT_ID,
        ChallengeName: ChallengeNameType.SOFTWARE_TOKEN_MFA,
        Session: session,
        ChallengeResponses: { USERNAME: username, SOFTWARE_TOKEN_MFA_CODE: totp },
      }));
      if (res.AuthenticationResult?.AccessToken) {
        onLogin(res.AuthenticationResult.AccessToken);
      }
    } catch {
      setError("Invalid MFA code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await cognitoClient.send(new RespondToAuthChallengeCommand({
        ClientId: CLIENT_ID,
        ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
        Session: session,
        ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword },
      }));
      if (res.ChallengeName === ChallengeNameType.SOFTWARE_TOKEN_MFA) {
        setSession(res.Session);
        setStep("mfa");
      } else if (res.AuthenticationResult?.AccessToken) {
        onLogin(res.AuthenticationResult.AccessToken);
      }
    } catch {
      setError("Password change failed. Ensure it meets the requirements.");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const verify = await cognitoClient.send(new VerifySoftwareTokenCommand({
        Session: session,
        UserCode: setupTotp,
      }));
      // After verifying, respond to the MFA_SETUP challenge
      const res = await cognitoClient.send(new RespondToAuthChallengeCommand({
        ClientId: CLIENT_ID,
        ChallengeName: "MFA_SETUP" as ChallengeNameType,
        Session: verify.Session,
        ChallengeResponses: { USERNAME: username },
      }));
      if (res.AuthenticationResult?.AccessToken) {
        onLogin(res.AuthenticationResult.AccessToken);
      } else if (res.ChallengeName === ChallengeNameType.SOFTWARE_TOKEN_MFA) {
        setSession(res.Session);
        setStep("mfa");
      }
    } catch {
      setError("Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Discharge Checklist</h1>

        {step === "credentials" && (
          <>
            <p style={styles.subtitle}>Sign in to continue</p>
            <form onSubmit={handleCredentials} style={styles.form}>
              <label style={styles.label}>Username</label>
              <input style={styles.input} type="text" value={username}
                onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              <label style={styles.label}>Password</label>
              <input style={styles.input} type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              {error && <p style={styles.error}>{error}</p>}
              <button style={styles.button} type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </>
        )}

        {step === "new_password" && (
          <>
            <p style={styles.subtitle}>Set a new password to continue</p>
            <form onSubmit={handleNewPassword} style={styles.form}>
              <label style={styles.label}>New Password</label>
              <input style={styles.input} type="password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              <p style={styles.hint}>Min 12 chars, upper + lower + number + symbol</p>
              {error && <p style={styles.error}>{error}</p>}
              <button style={styles.button} type="submit" disabled={loading}>
                {loading ? "Saving..." : "Set Password"}
              </button>
            </form>
          </>
        )}

        {step === "mfa_setup" && (
          <>
            <p style={styles.subtitle}>Set up authenticator app</p>
            <p style={styles.hint}>Enter this secret in Google Authenticator or Authy:</p>
            <p style={{ ...styles.hint, fontFamily: "monospace", wordBreak: "break-all", fontSize: 13, color: "#2d3748" }}>{secretCode}</p>
            <form onSubmit={handleMfaSetup} style={styles.form}>
              <label style={styles.label}>Verification Code</label>
              <input style={styles.input} type="text" value={setupTotp} inputMode="numeric"
                maxLength={6} onChange={(e) => setSetupTotp(e.target.value)} autoComplete="one-time-code" />
              {error && <p style={styles.error}>{error}</p>}
              <button style={styles.button} type="submit" disabled={loading}>
                {loading ? "Verifying..." : "Verify & Continue"}
              </button>
            </form>
          </>
        )}

        {step === "mfa" && (
          <>
            <p style={styles.subtitle}>Enter your authenticator code</p>
            <form onSubmit={handleMfa} style={styles.form}>
              <label style={styles.label}>TOTP Code</label>
              <input style={styles.input} type="text" value={totp} inputMode="numeric"
                maxLength={6} onChange={(e) => setTotp(e.target.value)} autoComplete="one-time-code" />
              {error && <p style={styles.error}>{error}</p>}
              <button style={styles.button} type="submit" disabled={loading}>
                {loading ? "Verifying..." : "Verify"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0f4f8",
    fontFamily: "system-ui, sans-serif",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "2.5rem 2rem",
    width: 360,
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  },
  title: { margin: 0, fontSize: 24, color: "#1a202c" },
  subtitle: { color: "#718096", marginTop: 4, marginBottom: 24 },
  form: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 14, fontWeight: 600, color: "#4a5568" },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    fontSize: 15,
    outline: "none",
    marginBottom: 8,
  },
  hint: { fontSize: 12, color: "#a0aec0", margin: "0 0 8px" },
  button: {
    marginTop: 8,
    padding: "12px",
    background: "#3182ce",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  error: { color: "#e53e3e", fontSize: 13, margin: 0 },
};
