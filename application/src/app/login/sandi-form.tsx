"use client";

import { useActionState } from "react";
import { loginSandiAction, type LoginState } from "@/lib/actions/auth";
import { ThemeButton } from "@/components/theme-button";

const awal: LoginState = {};

export function SandiForm() {
  const [state, formAction, pending] = useActionState(loginSandiAction, awal);

  return (
    <form action={formAction} className="form survey-login-form__fields">
      <label className="survey-login-field" htmlFor="identitas">
        <span>Email atau ID</span>
        <input
          id="identitas"
          name="identitas"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "sandi-error" : undefined}
          className="form__control"
        />
      </label>
      <label className="survey-login-field" htmlFor="kataSandi">
        <span>Kata sandi</span>
        <input
          id="kataSandi"
          name="kataSandi"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "sandi-error" : undefined}
          className="form__control"
        />
      </label>

      {state.error && (
        <p id="sandi-error" role="alert" className="survey-login-error">
          {state.error}
        </p>
      )}

      <ThemeButton type="submit" variant="secondary" disabled={pending} className="survey-login-submit">
        {pending ? "Memeriksa…" : "Masuk"}
      </ThemeButton>
    </form>
  );
}
