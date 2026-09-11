"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { ThemeButton } from "@/components/theme-button";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    // `form` dan `form__control`: bentuk isian yang sama dipakai seluruh ruang survei, bukan kotak
    // tersendiri dengan sudut dan ukuran huruf milik halaman ini saja.
    <form action={formAction} className="form survey-login-form__fields">
      <label className="survey-login-field" htmlFor="loginIdentifier">
        <span>ID Pengguna</span>
        <input
          id="loginIdentifier"
          name="loginIdentifier"
          type="text"
          autoComplete="username"
          placeholder="mis. dosen1001"
          required
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "login-error" : undefined}
          className="form__control"
        />
      </label>

      {state.error && (
        <p id="login-error" role="alert" className="survey-login-error">
          {state.error}
        </p>
      )}

      <ThemeButton type="submit" disabled={isPending} className="survey-login-submit">
        {isPending ? "Memeriksa…" : "Masuk"}
      </ThemeButton>
    </form>
  );
}
