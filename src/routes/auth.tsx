import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { isRxMode, isPatientHost } from "@/lib/rx-mode";
import { loginIdentifierToEmail } from "@/lib/rx-staff";
import { isSuperAdminEmail } from "@/lib/super-admin-auth";
import { ensureSuperAdminCredentials } from "@/lib/super-admin-auth.functions";
import { resolveLoginIdentifier } from "@/lib/auth-identifier.functions";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    // On the patient domain (pt.…) the only login is the patient portal.
    if (isPatientHost()) throw redirect({ to: "/patient" });
    // getSession() reads the local session (no network round-trip) so the
    // auth page paints instantly instead of waiting on the auth server.
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const email = data.session.user?.email?.toLowerCase() ?? "";
      if (isSuperAdminEmail(email)) {
        throw redirect({ to: "/admin" });
      }
      throw redirect({ to: isRxMode() ? "/prescriptions" : "/dashboard" });
    }
  },
  head: () => ({ meta: [{ title: "Sign in — QweekPOS" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [qualification, setQualification] = useState("");
  const [requestedRole, setRequestedRole] = useState<"Doctor" | "Clinic" | "Salesman">("Doctor");
  const [clinicName, setClinicName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { first_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        // Make sure we have a session so the request row can be written as this user.
        const { data: s } = await supabase.auth.getSession();
        if (!s.session) {
          await supabase.auth.signInWithPassword({ email: email.trim(), password });
        }
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          const { error: reqErr } = await supabase.from("access_requests").insert({
            user_id: u.user.id,
            email: email.trim(),
            full_name: name.trim() || null,
            phone: phone.trim() || null,
            qualification:
              requestedRole === "Clinic"
                ? clinicName.trim() || null
                : qualification.trim() || null,
            requested_role: requestedRole,
          });
          if (reqErr && !`${reqErr.message}`.toLowerCase().includes("duplicate")) throw reqErr;
        }
        await supabase.auth.signOut();
        await qc.cancelQueries();
        qc.clear();
        toast.success("Request sent. An admin will approve your account shortly.");
        setMode("signin");
        setPassword("");
        setLoading(false);
        return;
      }

      let cleanEmail = email.trim().toLowerCase();

      // If user typed a username or phone number (no '@'), resolve it to their registered email
      if (!cleanEmail.includes("@")) {
        try {
          const resolved = await resolveLoginIdentifier({ data: { identifier: cleanEmail } });
          if (resolved?.email) {
            cleanEmail = resolved.email.trim().toLowerCase();
          } else {
            cleanEmail = loginIdentifierToEmail(cleanEmail).trim().toLowerCase();
          }
        } catch (resolveErr) {
          console.warn("[auth] username resolution fallback:", resolveErr);
          cleanEmail = loginIdentifierToEmail(cleanEmail).trim().toLowerCase();
        }
      }

      // Pre-provision super admin if needed
      if (isSuperAdminEmail(cleanEmail)) {
        try {
          await ensureSuperAdminCredentials({ data: { email: cleanEmail, password } });
        } catch (setupErr) {
          console.warn("[auth] pre-provisioning super admin note:", setupErr);
        }
      }

      let { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error && isSuperAdminEmail(cleanEmail)) {
        try {
          await ensureSuperAdminCredentials({ data: { email: cleanEmail, password } });
          const retry = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
          error = retry.error;
        } catch (retryErr) {
          console.warn("[auth] retry provisioning super admin error:", retryErr);
        }
      }

      if (error) throw error;

      // Drop any cached data from a previous session so the dashboard does not
      // render stale rows (a common cause of the "hung" screen after login).
      await qc.cancelQueries();
      qc.clear();
      const destination = isSuperAdminEmail(cleanEmail)
        ? "/admin"
        : isRxMode()
          ? "/prescriptions"
          : "/dashboard";
      navigate({ to: destination, replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Authentication failed");
      setLoading(false);
    }
  }



  const inputCls =
    "w-full h-12 sm:h-11 rounded-lg border border-border bg-input/80 px-3.5 text-base sm:text-sm outline-none transition-all duration-200 focus:border-primary focus:bg-input focus:ring-2 focus:ring-primary/25 focus:-translate-y-px";

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/20 px-4 py-8 sm:p-6">
      {/* soft colour blobs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 animate-pulse rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 animate-pulse rounded-full bg-accent/30 blur-3xl [animation-duration:6s]" />

      <div className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-2xl border border-border/60 bg-card/90 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="absolute inset-x-6 -top-px h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-lg font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform duration-300 hover:scale-105 hover:rotate-3">
            Q
          </span>
          <div>
            <h1 className="font-display bg-gradient-to-r from-primary to-foreground bg-clip-text text-xl font-semibold text-transparent sm:text-2xl">
              QweekPOS
            </h1>
            <p className="text-[11px] text-muted-foreground">POS • Clinic • Prescription</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in to your account" : "Create a new account"}
        </p>
        <form className="mt-5 space-y-3 sm:mt-6 sm:space-y-4" onSubmit={submit}>
          {mode === "signup" && (
            <>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                className={inputCls}
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone (optional)"
                inputMode="tel"
                className={inputCls}
              />
              <select
                value={requestedRole}
                onChange={(e) =>
                  setRequestedRole(e.target.value as "Doctor" | "Clinic" | "Salesman")
                }
                className={inputCls}
              >
                <option value="Doctor">I am a Doctor (Prescriptions)</option>
                <option value="Clinic">We are a Clinic (doctors + serial)</option>
                <option value="Salesman">I am shop staff (POS)</option>
              </select>
              {requestedRole === "Clinic" && (
                <input
                  required
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="Clinic name & address"
                  className={inputCls}
                />
              )}
              {requestedRole === "Doctor" && (
                <input
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  placeholder="Qualification / designation (optional)"
                  className={inputCls}
                />
              )}
            </>
          )}

          <input
            required
            type={mode === "signup" ? "email" : "text"}
            inputMode={mode === "signup" ? "email" : "text"}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={mode === "signup" ? "Email" : "Email or username"}
            className={inputCls}
          />
          <div className="relative">
            <input
              required
              type={showPassword ? "text" : "password"}
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={`${inputCls} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button
            disabled={loading}
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary/75 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary/35 hover:brightness-105 active:scale-[0.98] disabled:opacity-60 sm:h-11"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading
              ? mode === "signin"
                ? "Signing in…"
                : "Creating account…"
              : mode === "signin"
                ? "Sign in"
                : "Sign up"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          disabled={loading}
          className="mt-4 w-full py-2 text-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

