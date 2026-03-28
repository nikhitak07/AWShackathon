import React, { useState } from "react";
import { useTheme } from "../ThemeContext";
import { ThemeToggle } from "./ThemeToggle";
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  SignUpCommand,
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

type Step = "credentials" | "signup" | "mfa" | "new_password" | "mfa_setup";

export const Login: React.FC<Props> = ({ onLogin }) => {
  const { tokens, theme } = useTheme();
  const isDark = theme === "dark";

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !name || !password) { setError("Please fill in all fields."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setError(""); setLoading(true);
    try {
      await cognitoClient.send(new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: username,
        Password: password,
        UserAttributes: [{ Name: "name", Value: name }],
      }));
      setPassword(""); setConfirmPassword("");
      setStep("credentials");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign up failed.";
      setError(msg);
    } finally { setLoading(false); }
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
      } else { finish(res.AuthenticationResult); }
    } catch { setError("Invalid credentials. Please try again."); }
    finally { setLoading(false); }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await cognitoClient.send(new RespondToAuthChallengeCommand({
        ClientId: CLIENT_ID, ChallengeName: ChallengeNameType.SOFTWARE_TOKEN_MFA, Session: session,
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
        ClientId: CLIENT_ID, ChallengeName: ChallengeNameType.NEW_PASSWORD_REQUIRED, Session: session,
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
        ClientId: CLIENT_ID, ChallengeName: "MFA_SETUP" as ChallengeNameType, Session: verify.Session,
        ChallengeResponses: { USERNAME: username },
      }));
      if (res.ChallengeName === ChallengeNameType.SOFTWARE_TOKEN_MFA) {
        setSession(res.Session); setStep("mfa");
      } else { finish(res.AuthenticationResult); }
    } catch { setError("Invalid code. Please try again."); }
    finally { setLoading(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "14px 16px", background: "transparent", border: "none",
    fontSize: 15, color: tokens.textInput, outline: "none",
    boxSizing: "border-box", display: "block", fontFamily: "inherit",
  };
  const fieldGroup: React.CSSProperties = {
    background: tokens.fieldGroupBg, borderRadius: 14,
    border: `1px solid ${tokens.border}`, overflow: "hidden",
  };
  const primaryBtn: React.CSSProperties = {
    padding: "15px", background: "linear-gradient(135deg, #007AFF, #0063d1)",
    color: "#fff", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 700,
    cursor: "pointer", opacity: loading ? 0.5 : 1, fontFamily: "inherit",
  };

  return (
    <div style={{ minHeight: "100vh", background: tokens.pageBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif", overflow: "hidden", position: "relative", padding: 24 }}>
      <div style={{ position: "absolute", top: "-10%", left: "-5%", width: 500, height: 500, background: tokens.orb1, borderRadius: "50%", animation: "float1 12s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "-15%", right: "-10%", width: 600, height: 600, background: tokens.orb2, borderRadius: "50%", animation: "float2 15s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${tokens.gridLine} 1px,transparent 1px),linear-gradient(90deg,${tokens.gridLine} 1px,transparent 1px)`, backgroundSize: "60px 60px", pointerEvents: "none" }} />

      <div style={{ position: "absolute", top: 20, right: 24, zIndex: 10 }}>
        <ThemeToggle />
      </div>

      <div style={{ position: "relative", zIndex: 1, background: tokens.cardBg, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: `1px solid ${tokens.border}`, borderRadius: 24, padding: "40px 36px", width: "100%", maxWidth: 400, boxShadow: isDark ? "0 24px 80px rgba(0,0,0,0.4)" : "0 8px 40px rgba(0,0,0,0.10)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, background: "linear-gradient(135deg, #007AFF, #5856d6)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,122,255,0.35)" }}>
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
              <path d="M10 22V14l6-4 6 4v8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="13" y="17" width="6" height="5" rx="1" stroke="#fff" strokeWidth="2"/>
            </svg>
          </div>
          <span style={{ fontSize: 20, fontWeight: 800, color: tokens.textPrimary, letterSpacing: "-0.4px" }}>MediGuide</span>
        </div>

        {step === "credentials" && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.5px" }}>Sign in</h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: tokens.textMuted, lineHeight: 1.5 }}>Welcome back. Enter your credentials to continue.</p>
            <form onSubmit={handleCredentials} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={fieldGroup}>
                <input style={inputStyle} type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
                <div style={{ height: 1, background: tokens.fieldDivider, margin: "0 16px" }} />
                <input style={inputStyle} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              {error && <p style={{ color: "#ff453a", fontSize: 13, margin: 0, textAlign: "center" }}>{error}</p>}
              <button style={primaryBtn} type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign In"}</button>
            </form>
            <p style={{ margin: "16px 0 0", fontSize: 13, color: tokens.textMuted, textAlign: "center" }}>
              Don't have an account?{" "}
              <button onClick={() => { setError(""); setStep("signup"); }} style={{ background: "none", border: "none", color: "#007AFF", cursor: "pointer", fontSize: 13, fontFamily: "inherit", padding: 0 }}>Sign up</button>
            </p>
          </>
        )}

        {step === "signup" && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.5px" }}>Create account</h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: tokens.textMuted, lineHeight: 1.5 }}>Sign up to get started.</p>
            <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={fieldGroup}>
                <input style={inputStyle} type="text" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                <div style={{ height: 1, background: tokens.fieldDivider, margin: "0 16px" }} />
                <input style={inputStyle} type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
                <div style={{ height: 1, background: tokens.fieldDivider, margin: "0 16px" }} />
                <input style={inputStyle} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                <div style={{ height: 1, background: tokens.fieldDivider, margin: "0 16px" }} />
                <input style={inputStyle} type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              </div>
              {error && <p style={{ color: "#ff453a", fontSize: 13, margin: 0, textAlign: "center" }}>{error}</p>}
              <button style={primaryBtn} type="submit" disabled={loading}>{loading ? "Creating account…" : "Sign Up"}</button>
            </form>
            <p style={{ margin: "16px 0 0", fontSize: 13, color: tokens.textMuted, textAlign: "center" }}>
              Already have an account?{" "}
              <button onClick={() => { setError(""); setStep("credentials"); }} style={{ background: "none", border: "none", color: "#007AFF", cursor: "pointer", fontSize: 13, fontFamily: "inherit", padding: 0 }}>Sign in</button>
            </p>
          </>
        )}

        {step === "new_password" && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.5px" }}>New password</h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: tokens.textMuted }}>Create a new password to continue.</p>
            <form onSubmit={handleNewPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={fieldGroup}>
                <input style={inputStyle} type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <p style={{ fontSize: 12, color: tokens.textMuted, margin: "0 0 4px" }}>Min 12 chars · upper + lower + number + symbol</p>
              {error && <p style={{ color: "#ff453a", fontSize: 13, margin: 0, textAlign: "center" }}>{error}</p>}
              <button style={primaryBtn} type="submit" disabled={loading}>{loading ? "Saving…" : "Set Password"}</button>
            </form>
          </>
        )}

        {step === "mfa_setup" && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.5px" }}>Set up 2FA</h2>
            <p style={{ margin: "0 0 8px", fontSize: 14, color: tokens.textMuted }}>Enter this secret in Google Authenticator or Authy:</p>
            <p style={{ fontFamily: "monospace", fontSize: 12, color: tokens.textMuted, background: tokens.fieldGroupBg, borderRadius: 8, padding: "10px 14px", wordBreak: "break-all", marginBottom: 12, border: `1px solid ${tokens.border}` }}>{secretCode}</p>
            <form onSubmit={handleMfaSetup} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={fieldGroup}>
                <input style={inputStyle} type="text" placeholder="6-digit code" value={setupTotp} inputMode="numeric" maxLength={6} onChange={(e) => setSetupTotp(e.target.value)} autoComplete="one-time-code" />
              </div>
              {error && <p style={{ color: "#ff453a", fontSize: 13, margin: 0, textAlign: "center" }}>{error}</p>}
              <button style={primaryBtn} type="submit" disabled={loading}>{loading ? "Verifying…" : "Verify & Continue"}</button>
            </form>
          </>
        )}

        {step === "mfa" && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, color: tokens.textPrimary, letterSpacing: "-0.5px" }}>Two-factor auth</h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: tokens.textMuted }}>Enter the code from your authenticator app.</p>
            <form onSubmit={handleMfa} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={fieldGroup}>
                <input style={inputStyle} type="text" placeholder="6-digit code" value={totp} inputMode="numeric" maxLength={6} onChange={(e) => setTotp(e.target.value)} autoComplete="one-time-code" />
              </div>
              {error && <p style={{ color: "#ff453a", fontSize: 13, margin: 0, textAlign: "center" }}>{error}</p>}
              <button style={primaryBtn} type="submit" disabled={loading}>{loading ? "Verifying…" : "Verify"}</button>
            </form>
          </>
        )}
      </div>

      <style>{`
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,-30px)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-25px,20px)}}
        input::placeholder { color: ${tokens.textMuted} !important; opacity: 1; }
      `}</style>
    </div>
  );
};
