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
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {participants.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-2.5 text-[14px]">
              <div>
                <span className="font-medium text-[var(--foreground)]">{p.nameSnapshot}</span>{" "}
                <span className="text-[12px] text-[var(--muted)]">— {p.unitSnapshot}</span>
              </div>
              {editable && (
                <form action={removeCategoryObjectAction}>
                  <input type="hidden" name="categoryObjectId" value={p.id} />
                  <input type="hidden" name="periodId" value={periodId} />
                  <input type="hidden" name="categoryId" value={categoryId} />
                  <button
                    type="submit"
                    className="text-[12px] font-medium text-[var(--muted)] hover:text-[var(--danger)] hover:underline"
                  >
                    Keluarkan
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-[var(--muted)]">Belum ada peserta.</p>
      )}

      {editable && (
        <form action={addFormAction} className="space-y-2">
          <input type="hidden" name="periodId" value={periodId} />
          <input type="hidden" name="categoryId" value={categoryId} />
          {candidateObjects.length === 0 ? (
            <p className="text-[13px] text-[var(--muted)]">
              Tidak ada objek jenis ini yang tersedia. Tambahkan lebih dulu di halaman Objek
              Penilaian.
            </p>
          ) : (
            <>
              <select
                name="objectIds"
                multiple
                size={Math.min(6, candidateObjects.length)}
                className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
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
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
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
