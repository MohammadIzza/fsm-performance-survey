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
      <div className="app-panel app-panel--ruled">
        <h2 className="app-panel__label">
          Finalisasi
        </h2>

        {preview.blockers.length > 0 && (
          <div className="app-note app-note--gagal mb-4">
            <p className="mb-2 app-text-sm font-medium text-[var(--danger)]">
              Tidak dapat difinalkan:
            </p>
            <ul className="list-disc space-y-1 pl-5 app-text-sm text-[var(--danger)]">
              {preview.blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}

        {preview.warnings.length > 0 && (
          <div className="mb-4 app-note app-note--perhatian">
            <p className="mb-2 app-text-sm font-medium text-amber-900">
              Catatan sebelum finalisasi (tidak memblokir):
            </p>
            <ul className="list-disc space-y-1 pl-5 app-text-sm text-amber-900">
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
              className="form__control"
            />
            <label className="flex items-start gap-2 app-text-sm text-[var(--foreground)]">
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
              className="app-btn app-btn--primary"
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
      <div className="app-panel app-panel--ruled">
        <h2 className="app-panel__label">
          {status === "FINAL" ? "Hasil telah difinalkan" : "Buka jendela koreksi"}
        </h2>
        {!showRevisionForm ? (
          <button
            type="button"
            onClick={() => setShowRevisionForm(true)}
            className="app-btn"
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
              className="form__control"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={revisionPending}
                className="app-btn app-btn--primary"
              >
                {revisionPending ? "Membuka…" : "Konfirmasi buka revisi"}
              </button>
              <button
                type="button"
                onClick={() => setShowRevisionForm(false)}
                className="app-btn"
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
          <p className="mt-3 app-text-xs text-[var(--muted)]">
            Hasil final tetap dapat ditelusuri sebagai versi terdahulu setelah revisi baru dibuat
           .
          </p>
        )}
      </div>
    );
  }

  return null;
}
