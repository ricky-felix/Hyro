/**
 * AuthContext.jsx — Real email/phone+password authentication (Workstream C4).
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * REQUIRED SUPABASE PROJECT SETTINGS (dashboard.supabase.com → project settings)
 * ──────────────────────────────────────────────────────────────────────────────
 *  Authentication → Providers → Email
 *    ✓ Enable Email provider
 *    ✓ "Confirm email" → DISABLE for a seamless password-only flow.
 *      (If left enabled, signUp returns a user with no session and the user
 *       must click the confirmation link before they can sign in. The code
 *       handles this gracefully but it breaks the "register and enter
 *       immediately" UX. For production you may want to enable it.)
 *
 *  Authentication → Providers → Phone
 *    ✓ Enable Phone provider
 *    ✓ "Confirm phone" → DISABLE. Without a paid SMS provider this setting
 *      MUST be off; otherwise Supabase requires an OTP SMS for every phone
 *      sign-up, which will fail unless Twilio/MessageBird/etc. is configured.
 *      Password-only phone auth works only when "Confirm phone" is disabled.
 *
 *  Authentication → Providers → Anonymous
 *    ✗ Not required / can be disabled — anonymous sessions are no longer used.
 *
 *  Optionally, in Authentication → Settings:
 *    • Minimum password length: 8 (the UI enforces this already)
 *    • Site URL / Redirect URLs: add your production domain
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Exported context value:
 *   user           – Supabase User | null
 *   session        – Supabase Session | null
 *   profile        – row from `users` table | null  (kept for downstream consumers)
 *   loading        – boolean — true while initial session is resolving
 *   isAuthenticated– boolean (true when session exists)
 *   register({ email, phone, password, name }) → Promise<void>
 *   login({ identifier, password })           → Promise<void>
 *   logout()                                  → Promise<void>
 *   updateProfile(updates)                    → Promise<void>
 *
 * NOTE: The old signInAnonymously / signUp / signIn / signOut / convertToAccount
 * names are gone. Any component that imported those must be updated to the new API.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { usersService } from "../services/users.service";
import { parseIdentifier } from "../utils/identifier";
import { config } from "../config";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Session bootstrap ─────────────────────────────────────────────────────
  useEffect(() => {
    // Hydrate from any persisted session (localStorage / cookie).
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session ?? null;
      // C4: anonymous sessions are no longer used. A leftover pre-C4 anonymous
      // session would otherwise slip past <ProtectedRoute> and surface the user
      // as a guest ("Tamu"). Terminate it and stay logged-out.
      if (s?.user?.is_anonymous) {
        supabase.auth.signOut().catch(() => {});
        setSession(null);
        setLoading(false);
        return;
      }
      setSession(s);
      if (s?.user) {
        // Load the profile from the backend (GET /users/me). The profile row is
        // created by the handle_new_user DB trigger from the registered name —
        // the frontend never writes it, so there is no guest/"Tamu" placeholder.
        // On failure (e.g. offline), keep whatever profile is already in state
        // rather than wiping it to null — a user who opens the app offline
        // should still see their cached profile, not a blank one.
        usersService.getMe().then(setProfile).catch(() => {});
      }
      setLoading(false);
    });

    // Keep in sync with Supabase's own state changes (token refresh, sign-out
    // from another tab, etc.).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s?.user?.is_anonymous) {
        supabase.auth.signOut().catch(() => {});
        setSession(null);
        setProfile(null);
        return;
      }
      setSession(s ?? null);
      if (s?.user) {
        usersService.getMe().then(setProfile).catch(() => {});
      } else {
        setProfile(null);
      }
    });

    // Reconnect safety net: supabase-js's own auto-refresh timer already
    // retries quietly on network failure without signing out (it only signs
    // out on a confirmed-invalid refresh token), but a device that was
    // offline past its access token's expiry won't get a timer tick until
    // it's due — nudge a refresh attempt as soon as the browser reports
    // connectivity again so the session is current by the time the user
    // acts on it, not whenever the next scheduled tick happens to land.
    const onReconnect = () => {
      supabase.auth.getSession().catch(() => {});
    };
    window.addEventListener("online", onReconnect);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("online", onReconnect);
    };
  }, []);

  // ── register ─────────────────────────────────────────────────────────────
  /**
   * Register a new account. Both email and phone number are required; email +
   * password is the auth credential, the phone number is stored on the profile.
   *
   * Email is the only login credential for now (phone login is a future
   * feature). signUp accepts either an email OR a phone, never both, so email is
   * the credential and the phone is passed in user metadata; the handle_new_user
   * DB trigger copies it into users.phone for display/profile use. The phone is
   * deliberately NOT promoted onto auth.users.phone — until phone login ships
   * there is no reason to, and leaving it off keeps the phone from becoming a
   * login credential.
   *
   * @param {{ email: string, phone: string, password: string, name: string }} opts
   * @throws Error with a user-friendly Indonesian message.
   */
  async function register({ email, phone, password, name }) {
    const parsedEmail = parseIdentifier(email);
    if (!parsedEmail || parsedEmail.type !== "email") {
      throw new Error("Masukkan alamat email yang valid.");
    }
    const parsedPhone = parseIdentifier(phone);
    if (!parsedPhone || parsedPhone.type !== "phone") {
      throw new Error("Masukkan nomor HP yang valid.");
    }

    const { data, error } = await supabase.auth.signUp({
      email: parsedEmail.email,
      password,
      options: { data: { full_name: name, phone: parsedPhone.phone } },
    });
    if (error) throw error;

    // ── Confirmation-pending case ─────────────────────────────────────────
    // When "Confirm email" is ENABLED in Supabase, signUp returns a user
    // object but session is null — the user must click the confirmation link
    // first. Surface a clear message instead of silently hanging.
    if (data.user && !data.session) {
      // Don't throw here — let the caller show the "please confirm" message.
      // We communicate this via the returned object being a no-session state.
      // The caller (LoginOrRegister) checks for this condition.
      throw new Error(
        "Silakan konfirmasi akun kamu. Kami mengirim tautan verifikasi ke " +
        parsedEmail.email + "."
      );
    }
  }

  // ── login ─────────────────────────────────────────────────────────────────
  /**
   * Sign in with email + password.
   *
   * Email is the only supported login credential for now — phone login is a
   * future feature (it would require promoting the phone onto auth.users and
   * enabling the Supabase Phone provider). Until then we only accept email.
   *
   * @param {{ identifier: string, password: string }} opts — `identifier` is an email
   * @throws Error with a user-friendly Indonesian message.
   */
  async function login({ identifier, password }) {
    const parsed = parseIdentifier(identifier);
    if (parsed?.type !== "email") {
      throw new Error("Masukkan alamat email yang valid.");
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password,
    });
    if (error) throw error;
  }

  // ── logout ────────────────────────────────────────────────────────────────
  /**
   * Sign out and clear local session. Does NOT re-create an anonymous session.
   */
  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // State is cleaned up by the onAuthStateChange listener above.

    // Wipe the offline cache + outbox — don't leave another person's group
    // data, payment history, or queued writes sitting in this browser after
    // they sign out of it.
    if (config.offlineEnabled) {
      const { clearAllData } = await import("../offline/db");
      await clearAllData().catch(() => {});
    }
  }

  // ── updateProfile ─────────────────────────────────────────────────────────
  async function updateProfile(updates) {
    if (!session?.user) return;
    // PATCH /users/me — returns the updated row; fall back to a local merge.
    const updated = await usersService.updateMe(updates);
    setProfile((prev) => updated ?? { ...prev, ...updates });
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const user = session?.user ?? null;
  // Anonymous sessions don't count as authenticated (C4 — guest accounts removed).
  const isAuthenticated = !!session && !user?.is_anonymous;

  // ── Backward-compatibility shims ─────────────────────────────────────────
  // isAnonymous: always false — anonymous sessions were removed in C4.
  // Kept so frozen v1 components (SaveAccountBanner, v1 ProfilPage, etc.)
  // that still destructure { isAnonymous } from useAuth() compile without errors.
  // They simply branch on false and show nothing, which is the correct UX.
  const isAnonymous = false;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isAuthenticated,
        // Compat shim — always false, keeps v1 components compiling.
        isAnonymous,
        register,
        login,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
