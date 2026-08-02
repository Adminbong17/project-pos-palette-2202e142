import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { isRxMode } from "@/lib/rx-mode";
import { loginIdentifierToEmail } from "@/lib/rx-staff";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() reads the local session (no network round-trip) so the
    // auth page paints instantly instead of waiting on the auth server.
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: isRxMode() ? "/prescriptions" : "/dashboard" });
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
  const [requestedRole, setRequestedRole] = useState<"Doctor" | "Salesman">("Doctor");
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
            qualification: qualification.trim() || null,
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

      const { error } = await supabase.auth.signInWithPassword({
        email: loginIdentifierToEmail(email),
        password,
      });
      if (error) throw error;

      // Drop any cached data from a previous session so the dashboard does not
      // render stale rows (a common cause of the "hung" screen after login).
      await qc.cancelQueries();
      qc.clear();
      navigate({ to: isRxMode() ? "/prescriptions" : "/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Authentication failed");
      setLoading(false);
    }
  }



  const inputCls =
    "w-full h-12 sm:h-11 rounded-lg border border-border bg-input px-3.5 text-base sm:text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-5 shadow-lg sm:p-8">
        <h1 className="font-display text-xl font-semibold sm:text-2xl">QweekPOS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
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
                onChange={(e) => setRequestedRole(e.target.value as "Doctor" | "Salesman")}
                className={inputCls}
              >
                <option value="Doctor">I am a Doctor (Prescriptions)</option>
                <option value="Salesman">I am shop staff (POS)</option>
              </select>
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
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
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
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground disabled:opacity-60 sm:h-11"
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

