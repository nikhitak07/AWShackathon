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
  onLogin: (token: string) => void;
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

  const finish = (result: { AccessToken?: string; IdToken?: string } | undefined) => {
    if (result?.IdToken) onLogin(result.IdToken);
    else if (result?.AccessToken) onLogin(result.AccessToken);
  };

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError("Please enter your username and password."); return; }
    setError(""); setLoading(true);
    try {
      const res = await cognitoClient.send(new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: CLIENT_ID,
        AuthParameters: { USERNAME: username, PASSWORD: password },
      }));
      if (res.ChallengeName === ChallengeNameType.SOFTWARE_TOKEN_MFA) {
        setSession(res.Session); setStep("mfa");
      } else if (res.ChallengeName === ChallengeNameType.NEW_PASSWORD_REQUIRED) {
        setSession(res.Session); setStep("new_password");
      } else if ((res.ChallengeName as string) === "MFA_SETUP") {
        setSession(res.Session);
        const assoc = await cognitoClient.send(new AssociateSoftwareTokenCommand({ Session: res.Session }));
        setSecretCode(assoc.SecretCode ?? ""); setSession(assoc.Session); setStep("mfa_setup");
      } else {
        finish(res.AuthenticationResult);
      }
    } catch { setError("Invalid credentials. Please try again."); }
    finally { setLoading(false); }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await cognitoClient.send(new RespondToAuthChallengeCommand({
        ClientId: CLIENT_ID,
        ChallengeName: ChallengeNameType.SOFTWARE_TOKEN_MFA,
        Session: session,
        ChallengeResponses: { USERNAME: username, SOFTWARE_TOKEN_MFA_CODE: totp },
      }));
      finish(res.AuthenticationResult);
    } catch { setError("Invalid MFA code. Please try again."); }
    finally { setLoading(false); }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await cognitoClient.send(new RespondToAuthChallengeCommand({
        ClientId: CLIENT_ID,
        ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED,
        Session: session,
        ChallengeResponses: { USERNAME: username, NEW_PASSWORD: newPassword },
      }));
      if (res.ChallengeName === ChallengeNameType.SOFTWARE_TOKEN_MFA) {
        setSession(res.Session); setStep("mfa");
      } else {
        finish(res.AuthenticationResult);
      }
    } catch { setError("Password change failed. Ensure it meets the requirements."); }
    finally { setLoading(false); }
  };

  const handleMfaSetup = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const verify = await cognitoClient.send(new VerifySoftwareTokenCommand({ Session: session, UserCode: setupTotp }));
      const res = await cognitoClient.send(new RespondToAuthChallengeCommand({
        ClientId: CLIENT_ID,
        ChallengeName: "MFA_SETUP" as ChallengeNameType,
        Session: verify.Session,
        ChallengeResponses: { USERNAME: username },
      }));
      if (res.ChallengeName === ChallengeNameType.SOFTWARE_TOKEN_MFA) {
        setSession(res.Session); setStep("mfa");
      } else {
        finish(res.AuthenticationResult);
      }
    } catch { setError("Invalid code. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Discharge Checklist</h1>

        {step === "credentials" && (
          <>
            <p style={s.subtitle}>Sign in to continue</p>
            <form onSubmit={handleCredentials} style={s.form}>
              <input style={s.input} type="text" placeholder="Username" value={username}
                onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              <input style={s.input} type="password" placeholder="Password" value={password}
                onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              {error && <p style={s.error}>{error}</p>}
              <button style={s.button} type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          </>
        )}

        {step === "new_password" && (
          <>
            <p style={s.subtitle}>Create a new password</p>
            <form onSubmit={handleNewPassword} style={s.form}>
              <input style={s.input} type="password" placeholder="New password" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              <p style={s.hint}>Min 12 chars · upper + lower + number + symbol</p>
              {error && <p style={s.error}>{error}</p>}
              <button style={s.button} type="submit" disabled={loading}>
                {loading ? "Saving…" : "Set Password"}
              </button>
            </form>
          </>
        )}

        {step === "mfa_setup" && (
          <>
            <p style={s.subtitle}>Set up authenticator app</p>
            <p style={s.hint}>Enter this secret in Google Authenticator or Authy:</p>
            <p style={s.secretCode}>{secretCode}</p>
            <form onSubmit={handleMfaSetup} style={s.form}>
              <input style={s.input} type="text" placeholder="6-digit code" value={setupTotp}
                inputMode="numeric" maxLength={6} onChange={(e) => setSetupTotp(e.target.value)} />
              {error && <p style={s.error}>{error}</p>}
              <button style={s.button} type="submit" disabled={loading}>
                {loading ? "Verifying…" : "Verify & Continue"}
              </button>
            </form>
          </>
        )}

        {step === "mfa" && (
          <>
            <p style={s.subtitle}>Enter your authenticator code</p>
            <form onSubmit={handleMfa} style={s.form}>
              <input style={s.input} type="text" placeholder="6-digit code" value={totp}
                inputMode="numeric" maxLength={6} onChange={(e) => setTotp(e.target.value)} />
              {error && <p style={s.error}>{error}</p>}
              <button style={s.button} type="submit" disabled={loading}>
                {loading ? "Verifying…" : "Verify"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f0f4f8",
    fontFamily: "system-ui, sans-serif",
    padding: 16,
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "2.5rem 2rem",
    width: "100%",
    maxWidth: 380,
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
    textAlign: "center",
  },
  title: { margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "#1a202c" },
  subtitle: { color: "#718096", marginTop: 4, marginBottom: 24, fontSize: 15 },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  input: {
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 15,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  hint: { fontSize: 13, color: "#a0aec0", margin: "0 0 4px" },
  secretCode: {
    fontFamily: "monospace",
    fontSize: 13,
    background: "#f7fafc",
    borderRadius: 8,
    padding: "8px 12px",
    wordBreak: "break-all",
    marginBottom: 8,
  },
  button: {
    marginTop: 4,
    padding: "13px",
    background: "#3182ce",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  error: { color: "#e53e3e", fontSize: 13, margin: 0 },
};
