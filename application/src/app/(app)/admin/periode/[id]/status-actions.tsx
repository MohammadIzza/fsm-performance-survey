"use client";

import { useActionState } from "react";
import { transitionPeriodStatusAction } from "@/lib/actions/admin-periods";
import type { PeriodStatus } from "@/generated/prisma/enums";

function TransitionButton({
  formAction,
  periodId,
  target,
  label,
  pending,
}: {
  formAction: (formData: FormData) => void;
  periodId: string;
  target: PeriodStatus;
  label: string;
  pending: boolean;
}) {
  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="targetStatus" value={target} />
      <button
        type="submit"
        disabled={pending}
        className="app-btn app-btn--primary"
      >
        {label}
      </button>
    </form>
  );
}

export function StatusActions({
  periodId,
  status,
  problems,
}: {
  periodId: string;
  status: PeriodStatus;
  problems: string[];
}) {
  const [state, formAction, pending] = useActionState(transitionPeriodStatusAction, {});

  return (
    <div className="app-panel app-panel--ruled">
      <div className="flex flex-wrap items-center gap-3">
        {status === "DRAF" && (
          <TransitionButton
            formAction={formAction}
            periodId={periodId}
            target="SIAP"
            label="Tandai siap"
            pending={pending}
          />
        )}
        {status === "SIAP" && (
          <>
            <TransitionButton
              formAction={formAction}
              periodId={periodId}
              target="DRAF"
              label="Kembali ke draf"
              pending={pending}
            />
            <TransitionButton
              formAction={formAction}
              periodId={periodId}
              target="AKTIF"
              label="Buka periode"
              pending={pending}
            />
          </>
        )}
        {status === "AKTIF" && (
          <>
            <TransitionButton
              formAction={formAction}
              periodId={periodId}
              target="DITUTUP"
              label="Tutup periode"
              pending={pending}
            />
            <span className="app-text-sm text-[var(--muted)]">
              Penilai kini dapat mengisi formulir di halaman Tugas Saya.
            </span>
          </>
        )}
        {status === "REVISI" && (
          <>
            <TransitionButton
              formAction={formAction}
              periodId={periodId}
              target="DITUTUP"
              label="Selesaikan koreksi (kembali ke Ditutup)"
              pending={pending}
            />
            <span className="app-text-sm text-[var(--muted)]">
              Jendela koreksi terbuka — tugas yang dibuka kembali dapat diperbaiki penilainya.
            </span>
          </>
        )}
      </div>

      {state.error && (
        <p role="alert" className="mt-3 whitespace-pre-line text-sm text-[var(--danger)]">
          {state.error}
        </p>
      )}

      {status === "DRAF" && problems.length > 0 && (
        <div className="mt-4 app-note app-note--perhatian">
          <p className="mb-2 app-text-sm font-medium text-amber-900">
            Belum memenuhi syarat &ldquo;Siap&rdquo;:
          </p>
          <ul className="list-disc space-y-1 pl-5 app-text-sm text-amber-900">
            {problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {status === "DRAF" && problems.length === 0 && (
        <p className="mt-4 app-text-sm text-[var(--success)]">
          Semua syarat konfigurasi terpenuhi — siap ditandai Siap.
        </p>
      )}
    </div>
  );
}
