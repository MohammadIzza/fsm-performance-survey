"use client";

import { useActionState, useState } from "react";
import {
  reopenAssignmentAction,
  adminEditResponseAction,
  voidResponseAction,
} from "@/lib/actions/responses";
import type { AssignmentStatus } from "@/generated/prisma/enums";

interface ParameterView {
  id: string;
  name: string;
  order: number;
}

export function AdminTools({
  assignmentId,
  status,
  parameters,
  scale,
  effectiveRevisionId,
  effectiveScores,
}: {
  assignmentId: string;
  status: AssignmentStatus;
  parameters: ParameterView[];
  scale: { min: number; max: number; step: number };
  effectiveRevisionId: string | null;
  effectiveScores: Record<string, number>;
}) {
  const [reopenState, reopenAction, reopenPending] = useActionState(reopenAssignmentAction, {});
  const [voidState, voidAction, voidPending] = useActionState(voidResponseAction, {});
  const [editState, editAction, editPending] = useActionState(adminEditResponseAction, {});
  const [showEdit, setShowEdit] = useState(false);

  return (
    <div className="admin-tools form space-y-5">
      {/* Disusun sebagai tabel seperti lembar penilaian di atasnya: satu kolom nama tindakan, satu
          kolom isian, satu kolom tombol — dengan kepala kolom dan garis pemisah yang sama. Sebelumnya
          ketiganya baris flex lepas dengan lebar berbeda-beda, sehingga tidak ada satu pun tepi yang
          segaris. */}
      <div className="admin-actions">
        <div className="admin-actions__head" aria-hidden="true">
          <span>Tindakan</span>
          <span>Keterangan</span>
          <span>Jalankan</span>
        </div>

        {status === "TERKIRIM" && (
          <form action={reopenAction} className="admin-actions__row">
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <div className="admin-actions__name">
              <strong>Buka kembali</strong>
              <span>Penilai dapat mengisi ulang sampai tenggat koreksi.</span>
            </div>
            <div className="admin-actions__fields">
              <label className="admin-tools__field">
                <span>Tenggat koreksi (WIB)</span>
                <input
                  aria-label="Tenggat koreksi"
                  type="datetime-local"
                  name="correctionEndsAt"
                  required
                  className="form__control"
                />
              </label>
              <label className="admin-tools__field admin-tools__field--grow">
                <span>Alasan</span>
                <input
                  name="reason"
                  placeholder="Alasan pembukaan kembali"
                  required
                  className="form__control"
                />
              </label>
            </div>
            <div className="admin-actions__run">
              <button
                type="submit"
                disabled={reopenPending}
                className="admin-action admin-action--primary"
              >
                {reopenPending ? "Memproses…" : "Buka kembali"}
              </button>
            </div>
          </form>
        )}

        <div className="admin-actions__row">
          <div className="admin-actions__name">
            <strong>Edit langsung</strong>
            <span>Mengoreksi skor tanpa membuka pengisian bagi penilai.</span>
          </div>
          <div className="admin-actions__fields" />
          <div className="admin-actions__run">
            <button type="button" onClick={() => setShowEdit((v) => !v)} className="admin-action">
              {showEdit ? "Tutup" : "Buka"}
            </button>
          </div>
        </div>

        {status === "TERKIRIM" && effectiveRevisionId && (
          <form action={voidAction} className="admin-actions__row">
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <input type="hidden" name="responseRevisionId" value={effectiveRevisionId} />
            <div className="admin-actions__name">
              <strong>Batalkan jawaban</strong>
              <span>Jawaban dikeluarkan dari agregasi; riwayatnya tetap tersimpan.</span>
            </div>
            <div className="admin-actions__fields">
              <label className="admin-tools__field admin-tools__field--grow">
                <span>Alasan</span>
                <input
                  name="reason"
                  placeholder="Alasan pembatalan jawaban"
                  required
                  className="form__control"
                />
              </label>
            </div>
            <div className="admin-actions__run">
              <button
                type="submit"
                disabled={voidPending}
                className="admin-action admin-action--danger"
              >
                {voidPending ? "Memproses…" : "Batalkan"}
              </button>
            </div>
          </form>
        )}
      </div>
      {reopenState.error && <p className="text-sm text-[var(--danger)]">{reopenState.error}</p>}
      {voidState.error && <p className="text-sm text-[var(--danger)]">{voidState.error}</p>}

      {showEdit && (
        <form action={editAction} className="space-y-3 border-t border-[var(--border)] pt-4">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <p className="text-[12px] text-[var(--muted)]">
            Koreksi ini langsung tersimpan sebagai revisi terkirim baru (bukan draf) dan tercatat
            di jejak audit.
          </p>
          {parameters
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((p) => (
              <div key={p.id}>
                <input type="hidden" name="parameterId" value={p.id} />
                <label className="mb-1 block text-[13px] font-medium text-[var(--foreground)]">
                  {p.name}
                </label>
                <input
                  name="scoreValue"
                  type="number"
                  min={scale.min}
                  max={scale.max}
                  step={scale.step || "any"}
                  defaultValue={effectiveScores[p.id] ?? ""}
                  required
                  className="form__control"
                />
              </div>
            ))}
          <input
            name="reason"
            placeholder="Alasan koreksi (wajib)"
            required
            className="form__control"
          />
          <button
            type="submit"
            disabled={editPending}
            className="admin-action admin-action--primary"
          >
            {editPending ? "Menyimpan…" : "Simpan koreksi & kirim"}
          </button>
          {editState.error && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {editState.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
