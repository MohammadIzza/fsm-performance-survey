"use client";

import { useActionState } from "react";
import { addCategoryObjectsAction, removeCategoryObjectAction } from "@/lib/actions/admin-categories";
import type { getCategoryDetail } from "@/lib/services/categories";

type Participant = NonNullable<Awaited<ReturnType<typeof getCategoryDetail>>>["categoryObjects"][number];
type CandidateObject = { id: string; name: string; ownerUnit: { name: string } };

export function ParticipantManager({
  periodId,
  categoryId,
  participants,
  candidateObjects,
  editable,
}: {
  periodId: string;
  categoryId: string;
  participants: Participant[];
  candidateObjects: CandidateObject[];
  editable: boolean;
}) {
  const [addState, addFormAction, addPending] = useActionState(addCategoryObjectsAction, {});

  return (
    <div className="space-y-4">
      {participants.length > 0 ? (
        <ul className="app-stack">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <span className="font-medium text-[var(--foreground)]">{p.nameSnapshot}</span>{" "}
                <span className="app-text-xs text-[var(--muted)]">— {p.unitSnapshot}</span>
              </div>
              {editable && (
                <form action={removeCategoryObjectAction}>
                  <input type="hidden" name="categoryObjectId" value={p.id} />
                  <input type="hidden" name="periodId" value={periodId} />
                  <input type="hidden" name="categoryId" value={categoryId} />
                  <button
                    type="submit"
                    className="app-text-xs font-medium text-[var(--muted)] hover:text-[var(--danger)] hover:underline"
                  >
                    Keluarkan
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="app-text-sm text-[var(--muted)]">Belum ada peserta.</p>
      )}

      {editable && (
        <form action={addFormAction} className="space-y-2">
          <input type="hidden" name="periodId" value={periodId} />
          <input type="hidden" name="categoryId" value={categoryId} />
          {candidateObjects.length === 0 ? (
            <p className="app-text-sm text-[var(--muted)]">
              Tidak ada objek jenis ini yang tersedia. Tambahkan lebih dulu di halaman Objek
              Penilaian.
            </p>
          ) : (
            <>
              <select
                name="objectIds"
                multiple
                size={Math.min(6, candidateObjects.length)}
                className="form__control"
              >
                {candidateObjects.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.ownerUnit.name})
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={addPending}
                className="app-btn app-btn--primary"
              >
                {addPending ? "Menambahkan…" : "Tambahkan sebagai peserta"}
              </button>
            </>
          )}
          {addState.error && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {addState.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
