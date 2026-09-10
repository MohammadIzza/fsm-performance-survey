"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { ThemeButton } from "@/components/theme-button";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label
          htmlFor="loginIdentifier"
          className="mb-1.5 block text-sm font-medium text-[var(--foreground)]"
        >
          ID Pengguna
        </label>
        <input
          id="loginIdentifier"
          name="loginIdentifier"
          type="text"
          autoComplete="username"
          placeholder="mis. dosen1001"
          required
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "login-error" : undefined}
          className="w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 text-[15px] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
        />
      </div>

      {state.error && (
        <p id="login-error" role="alert" className="text-sm text-[var(--danger)]">
          {state.error}
        </p>
      )}

      <ThemeButton type="submit" disabled={isPending} size="lg" className="w-full">
        {isPending ? "Memeriksa…" : "Masuk"}
      </ThemeButton>
    </form>
  );
}
