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
  onLogin: (token: string, username: string) => void;
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
    if (result?.IdToken) onLogin(result.IdToken, username);
    else if (result?.AccessToken) onLogin(result.AccessToken, username);
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
      } else { finish(res.AuthenticationResult); }
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
      } else { finish(res.AuthenticationResult); }
    } catch { setError("Invalid code. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.orb1} />
      <div style={s.orb2} />
      <div style={s.grid} />

      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <div style={s.logoIcon}>
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
              <path d="M10 22V14l6-4 6 4v8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="13" y="17" width="6" height="5" rx="1" stroke="#fff" strokeWidth="2"/>
            </svg>
          </div>
          <span style={s.logoText}>MediGuide</span>
        </div>

        {step === "credentials" && (
          <>
            <h2 style={s.title}>Sign in</h2>
            <p style={s.subtitle}>Welcome back. Enter your credentials to continue.</p>
            <form onSubmit={handleCredentials} style={s.form}>
              <div style={s.fieldGroup}>
                <input style={s.input} type="text" placeholder="Username" value={username}
                  onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
                <div style={s.fieldDivider} />
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
            <h2 style={s.title}>New password</h2>
            <p style={s.subtitle}>Create a new password to continue.</p>
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
            <h2 style={s.title}>Set up 2FA</h2>
            <p style={s.subtitle}>Enter this secret in Google Authenticator or Authy:</p>
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
            <h2 style={s.title}>Two-factor auth</h2>
            <p style={s.subtitle}>Enter the code from your authenticator app.</p>
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

      <style>{`
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,-30px)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-25px,20px)}}
      `}</style>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#08080f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
    overflow: "hidden",
    position: "relative" as const,
    padding: 24,
  },
  orb1: {
    position: "absolute" as const, top: "-10%", left: "-5%",
    width: 500, height: 500,
    background: "radial-gradient(circle, rgba(0,122,255,0.15) 0%, transparent 65%)",
    borderRadius: "50%", animation: "float1 12s ease-in-out infinite", pointerEvents: "none" as const,
  },
  orb2: {
    position: "absolute" as const, bottom: "-15%", right: "-10%",
    width: 600, height: 600,
    background: "radial-gradient(circle, rgba(88,86,214,0.12) 0%, transparent 65%)",
    borderRadius: "50%", animation: "float2 15s ease-in-out infinite", pointerEvents: "none" as const,
  },
  grid: {
    position: "absolute" as const, inset: 0,
    backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)",
    backgroundSize: "60px 60px", pointerEvents: "none" as const,
  },
  card: {
    position: "relative" as const,
    zIndex: 1,
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 24,
    padding: "40px 36px",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
  },
  logoWrap: { display: "flex", alignItems: "center", gap: 10, marginBottom: 32 },
  logoIcon: {
    width: 40, height: 40,
    background: "linear-gradient(135deg, #007AFF, #5856d6)",
    borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 4px 16px rgba(0,122,255,0.35)",
  },
  logoText: { fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.4px" },
  title: { margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" },
  subtitle: { margin: "0 0 24px", fontSize: 14, color: "#636366", lineHeight: 1.5 },
  form: { display: "flex", flexDirection: "column" as const, gap: 12 },
  fieldGroup: {
    background: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  fieldDivider: { height: 1, background: "rgba(255,255,255,0.08)", margin: "0 16px" },
  input: {
    width: "100%",
    padding: "14px 16px",
    background: "transparent",
    border: "none",
    fontSize: 15,
    color: "#fff",
    outline: "none",
    boxSizing: "border-box" as const,
    display: "block",
    fontFamily: "inherit",
  },
  hint: { fontSize: 12, color: "#636366", margin: "0 0 4px" },
  secretCode: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#8e8e93",
    background: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    padding: "10px 14px",
    wordBreak: "break-all" as const,
    marginBottom: 12,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  button: {
    padding: "15px",
    background: "linear-gradient(135deg, #007AFF, #0063d1)",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "-0.2px",
    transition: "opacity 0.15s",
  },
  buttonDisabled: { opacity: 0.5, cursor: "not-allowed" },
  error: { color: "#ff453a", fontSize: 13, margin: 0, textAlign: "center" as const },
};
