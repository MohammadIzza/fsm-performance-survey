"use client";

import { useAksi } from "@/components/theme/notifikasi";
import { ThemeButton } from "@/components/theme-button";
import { Info } from "@/components/theme/info";
import { perbaruiProfilAction, type ProfilState } from "@/lib/actions/profil";

const awal: ProfilState = {};

export function ProfilForm({
  name,
  loginIdentifier,
}: {
  name: string;
  loginIdentifier: string;
}) {
  const [state, formAction, pending] = useAksi(perbaruiProfilAction, awal, "Profil tersimpan.");

  return (
    <form action={formAction} className="form grid gap-3 sm:grid-cols-2">
      <label className="admin-tools__field">
        <span>Nama lengkap</span>
        <input
          name="name"
          defaultValue={name}
          required
          maxLength={200}
          className="form__control"
        />
      </label>

      <label className="admin-tools__field">
        <span>
          NIM / NIP
          <Info>
            Nomor induk Anda, ditulis apa adanya — nol di depan tidak akan hilang. Dipakai
            mencocokkan Anda dengan data kepegawaian dan daftar penugasan.
          </Info>
        </span>
        <input
          name="loginIdentifier"
          defaultValue={loginIdentifier}
          required
          maxLength={64}
          inputMode="numeric"
          className="form__control"
        />
      </label>

      {state.error && (
        <p role="alert" className="sm:col-span-2 text-sm text-[var(--color-brand-1)]">
          {state.error}
        </p>
      )}

      <div className="sm:col-span-2">
        <ThemeButton type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan"}
        </ThemeButton>
      </div>
    </form>
  );
}
