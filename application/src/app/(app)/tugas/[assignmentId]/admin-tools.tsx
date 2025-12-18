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
      <div className="admin-tools__actions">
        {status === "TERKIRIM" && (
          <form action={reopenAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <label className="admin-tools__field"><span>Tenggat koreksi (WIB)</span><input aria-label="Tenggat koreksi" type="datetime-local" name="correctionEndsAt" required className="form__control" /></label>
            <input
              name="reason"
              placeholder="Alasan pembukaan kembali"
              required
              className="form__control"
            />
            <button
              type="submit"
              disabled={reopenPending}
              className="admin-action admin-action--primary"
            >
              {reopenPending ? "Memproses…" : "Buka kembali untuk pengisi"}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => setShowEdit((v) => !v)}
          className="admin-action"
        >
          {showEdit ? "Tutup edit langsung" : "Edit langsung"}
        </button>

        {status === "TERKIRIM" && effectiveRevisionId && (
          <form action={voidAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="assignmentId" value={assignmentId} />
            <input type="hidden" name="responseRevisionId" value={effectiveRevisionId} />
            <input
              name="reason"
              placeholder="Alasan pembatalan jawaban"
              required
              className="form__control"
            />
            <button
              type="submit"
              disabled={voidPending}
              className="admin-action admin-action--danger"
            >
              {voidPending ? "Memproses…" : "Batalkan jawaban (keluarkan dari agregasi)"}
            </button>
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
