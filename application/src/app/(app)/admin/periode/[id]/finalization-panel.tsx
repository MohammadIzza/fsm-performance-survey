"use client";

import { useActionState, useState } from "react";
import { finalizePeriodAction, openRevisionAction } from "@/lib/actions/finalization";
import type { FinalizationPreview } from "@/lib/services/finalization";
import type { PeriodStatus } from "@/generated/prisma/enums";

export function FinalizationPanel({
  periodId,
  status,
  preview,
}: {
  periodId: string;
  status: PeriodStatus;
  preview: FinalizationPreview | null;
}) {
  const [finalizeState, finalizeAction, finalizePending] = useActionState(finalizePeriodAction, {});
  const [revisionState, revisionAction, revisionPending] = useActionState(openRevisionAction, {});
  const [confirmed, setConfirmed] = useState(false);
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  if (status === "DITUTUP" && preview) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Finalisasi
        </h2>

        {preview.blockers.length > 0 && (
          <div className="mb-4 rounded-xl bg-[var(--danger)]/10 p-4">
            <p className="mb-2 text-[13px] font-medium text-[var(--danger)]">
              Tidak dapat difinalkan:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-[var(--danger)]">
              {preview.blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}

        {preview.warnings.length > 0 && (
          <div className="mb-4 rounded-xl bg-amber-50 p-4">
            <p className="mb-2 text-[13px] font-medium text-amber-900">
              Catatan sebelum finalisasi (tidak memblokir):
            </p>
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-amber-900">
              {preview.warnings.map((w, i) => (
                <li key={i}>
                  <strong>{w.categoryName}:</strong> {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {preview.ready && (
          <form action={finalizeAction} className="space-y-3">
            <input type="hidden" name="periodId" value={periodId} />
            <textarea
              name="note"
              placeholder="Catatan finalisasi (opsional)"
              rows={2}
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            <label className="flex items-start gap-2 text-[13px] text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              Saya memahami hasil ini akan ditetapkan resmi dan dapat diakses sesuai kebijakan
              waktu akses. Objek yang belum memenuhi minimum tetap ditandai tidak layak peringkat.
            </label>
            <button
              type="submit"
              disabled={!confirmed || finalizePending}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              {finalizePending ? "Memfinalkan…" : "Finalkan periode"}
            </button>
            {finalizeState.error && (
              <p role="alert" className="whitespace-pre-line text-sm text-[var(--danger)]">
                {finalizeState.error}
              </p>
            )}
          </form>
        )}
      </div>
    );
  }

  if (status === "DITUTUP" || status === "FINAL") {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
          {status === "FINAL" ? "Hasil telah difinalkan" : "Buka jendela koreksi"}
        </h2>
        {!showRevisionForm ? (
          <button
            type="button"
            onClick={() => setShowRevisionForm(true)}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-[14px] font-medium text-[var(--foreground)] transition hover:bg-black/[0.03]"
          >
            {status === "FINAL" ? "Buka revisi" : "Buka jendela koreksi"}
          </button>
        ) : (
          <form action={revisionAction} className="space-y-3">
            <input type="hidden" name="periodId" value={periodId} />
            <textarea
              name="reason"
              placeholder="Alasan pembukaan revisi (wajib)"
              required
              rows={2}
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={revisionPending}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {revisionPending ? "Membuka…" : "Konfirmasi buka revisi"}
              </button>
              <button
                type="button"
                onClick={() => setShowRevisionForm(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-[14px] font-medium text-[var(--foreground)] transition hover:bg-black/[0.03]"
              >
                Batal
              </button>
            </div>
            {revisionState.error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {revisionState.error}
              </p>
            )}
          </form>
        )}
        {status === "FINAL" && (
          <p className="mt-3 text-[12px] text-[var(--muted)]">
            Hasil final tetap dapat ditelusuri sebagai versi terdahulu setelah revisi baru dibuat
           .
          </p>
        )}
      </div>
    );
  }

  return null;
}
