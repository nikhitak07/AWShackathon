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
  onLogin: (accessToken: string, username: string) => void;
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
      } else if (res.AuthenticationResult?.AccessToken) {
<<<<<<< Updated upstream
        onLogin(res.AuthenticationResult.AccessToken, username);
=======
        onLogin(res.AuthenticationResult.IdToken ?? res.AuthenticationResult.AccessToken);
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
      if (res.AuthenticationResult?.AccessToken) onLogin(res.AuthenticationResult.AccessToken, username);
    } catch { setError("Invalid MFA code. Please try again."); }
    finally { setLoading(false); }
=======
      if (res.AuthenticationResult?.AccessToken) {
        onLogin(res.AuthenticationResult.IdToken ?? res.AuthenticationResult.AccessToken);
      }
    } catch {
      setError("Invalid MFA code. Please try again.");
    } finally {
      setLoading(false);
    }
>>>>>>> Stashed changes
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
      } else if (res.AuthenticationResult?.AccessToken) {
<<<<<<< Updated upstream
        onLogin(res.AuthenticationResult.AccessToken, username);
=======
        onLogin(res.AuthenticationResult.IdToken ?? res.AuthenticationResult.AccessToken);
>>>>>>> Stashed changes
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
      if (res.AuthenticationResult?.AccessToken) {
<<<<<<< Updated upstream
        onLogin(res.AuthenticationResult.AccessToken, username);
=======
        onLogin(res.AuthenticationResult.IdToken ?? res.AuthenticationResult.AccessToken);
>>>>>>> Stashed changes
      } else if (res.ChallengeName === ChallengeNameType.SOFTWARE_TOKEN_MFA) {
        setSession(res.Session); setStep("mfa");
      }
    } catch { setError("Invalid code. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoMark}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#007AFF"/>
            <path d="M10 22V14l6-4 6 4v8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="13" y="17" width="6" height="5" rx="1" stroke="#fff" strokeWidth="2"/>
          </svg>
        </div>
        <h1 style={s.title}>Discharge Checklist</h1>

        {step === "credentials" && (
          <>
            <p style={s.subtitle}>Sign in to your account</p>
            <form onSubmit={handleCredentials} style={s.form}>
              <div style={s.fieldGroup}>
                <input style={s.input} type="text" placeholder="Username" value={username}
                  onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
                <div style={s.divider} />
                <input style={s.input} type="password" placeholder="Password" value={password}
                  onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              {error && <p style={s.error}>{error}</p>}
              <button style={{ ...s.button, ...(loading ? s.buttonDisabled : {}) }} type="submit" disabled={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          </>
        )}

        {step === "new_password" && (
          <>
            <p style={s.subtitle}>Create a new password</p>
            <form onSubmit={handleNewPassword} style={s.form}>
              <div style={s.fieldGroup}>
                <input style={s.input} type="password" placeholder="New password" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <p style={s.hint}>Min 12 chars · upper + lower + number + symbol</p>
              {error && <p style={s.error}>{error}</p>}
              <button style={{ ...s.button, ...(loading ? s.buttonDisabled : {}) }} type="submit" disabled={loading}>
                {loading ? "Saving…" : "Set Password"}
              </button>
            </form>
          </>
        )}

        {step === "mfa_setup" && (
          <>
            <p style={s.subtitle}>Set up two-factor authentication</p>
            <p style={s.hint}>Enter this secret in Google Authenticator or Authy:</p>
            <p style={s.secretCode}>{secretCode}</p>
            <form onSubmit={handleMfaSetup} style={s.form}>
              <div style={s.fieldGroup}>
                <input style={s.input} type="text" placeholder="6-digit code" value={setupTotp}
                  inputMode="numeric" maxLength={6} onChange={(e) => setSetupTotp(e.target.value)} autoComplete="one-time-code" />
              </div>
              {error && <p style={s.error}>{error}</p>}
              <button style={{ ...s.button, ...(loading ? s.buttonDisabled : {}) }} type="submit" disabled={loading}>
                {loading ? "Verifying…" : "Verify & Continue"}
              </button>
            </form>
          </>
        )}

        {step === "mfa" && (
          <>
            <p style={s.subtitle}>Enter your authenticator code</p>
            <form onSubmit={handleMfa} style={s.form}>
              <div style={s.fieldGroup}>
                <input style={s.input} type="text" placeholder="6-digit code" value={totp}
                  inputMode="numeric" maxLength={6} onChange={(e) => setTotp(e.target.value)} autoComplete="one-time-code" />
              </div>
              {error && <p style={s.error}>{error}</p>}
              <button style={{ ...s.button, ...(loading ? s.buttonDisabled : {}) }} type="submit" disabled={loading}>
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
    background: "linear-gradient(160deg, #f2f2f7 0%, #e8eaf0 100%)",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
    padding: 16,
  },
  card: {
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: 20,
    padding: "2.5rem 2rem",
    width: "100%",
    maxWidth: 380,
    boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.8) inset",
    border: "1px solid rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  logoMark: { display: "flex", justifyContent: "center", marginBottom: 16 },
  title: { margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.3px" },
  subtitle: { color: "#8e8e93", marginTop: 4, marginBottom: 24, fontSize: 15 },
  form: { display: "flex", flexDirection: "column", gap: 12, textAlign: "left" },
  fieldGroup: {
    background: "#f2f2f7",
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid rgba(0,0,0,0.06)",
  },
  input: {
    width: "100%",
    padding: "13px 16px",
    background: "transparent",
    border: "none",
    fontSize: 16,
    color: "#1c1c1e",
    outline: "none",
    boxSizing: "border-box",
    display: "block",
  },
  divider: { height: 1, background: "rgba(0,0,0,0.08)", margin: "0 16px" },
  hint: { fontSize: 13, color: "#8e8e93", margin: "0 0 4px", textAlign: "center" as const },
  secretCode: {
    fontFamily: "monospace",
    fontSize: 13,
    color: "#1c1c1e",
    background: "#f2f2f7",
    borderRadius: 8,
    padding: "8px 12px",
    wordBreak: "break-all" as const,
    marginBottom: 12,
    textAlign: "center" as const,
  },
  button: {
    padding: "14px",
    background: "#007AFF",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "-0.1px",
    transition: "opacity 0.15s",
  },
  buttonDisabled: { opacity: 0.6, cursor: "not-allowed" },
  error: { color: "#ff3b30", fontSize: 13, margin: 0, textAlign: "center" as const },
};
