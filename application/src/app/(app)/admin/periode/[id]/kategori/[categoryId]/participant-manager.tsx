"use client";

import { useActionState } from "react";
import { addCategoryObjectsAction, removeCategoryObjectAction } from "@/lib/actions/admin-categories";
import type { getCategoryDetail } from "@/lib/services/categories";

type Participant = NonNullable<Awaited<ReturnType<typeof getCategoryDetail>>>["categoryObjects"][number];
type CandidateObject = { id: string; name: string; ownerUnit: { name: string } };

/**
 * Daftar objek yang dinilai dalam satu kategori.
 *
 * Sebelumnya tiap baris hanya nama besar dengan unit menempel di belakangnya, dan satu-satunya
 * tindakan — mengeluarkan objek — disembunyikan di balik tombol panah yang, begitu dibuka, cuma
 * berisi satu menu. Panah itu dihapus: tindakan tunggal tidak perlu dilipat. Nama dan unit kini
 * berdiri sebagai dua kolom berlabel, jadi terbaca sebagai daftar, bukan sebagai judul beruntun.
 */
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
    <div className="app-stack">
      {participants.length > 0 ? (
        <ul className="participant-list">
          <li className="participant-list__head" aria-hidden="true">
            <span>Nama objek</span>
            <span>Unit</span>
            {editable && <span>Aksi</span>}
          </li>
          {participants.map((p) => (
            <li key={p.id} className="participant-list__item">
              <span className="participant-list__name">{p.nameSnapshot}</span>
              <span className="participant-list__unit">
                <span className="participant-list__label">Unit</span>
                {p.unitSnapshot}
              </span>
              {editable && (
                <form action={removeCategoryObjectAction} className="participant-list__action">
                  <input type="hidden" name="categoryObjectId" value={p.id} />
                  <input type="hidden" name="periodId" value={periodId} />
                  <input type="hidden" name="categoryId" value={categoryId} />
                  <button type="submit" className="app-btn app-btn--polos app-btn--danger">
                    Keluarkan
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="app-text-sm text-[var(--muted)]">
          Belum ada objek yang dinilai pada kategori ini.
        </p>
      )}

      {editable && (
        <form action={addFormAction} className="participant-add">
          <input type="hidden" name="periodId" value={periodId} />
          <input type="hidden" name="categoryId" value={categoryId} />
          {candidateObjects.length === 0 ? (
            <p className="app-text-sm text-[var(--muted)]">
              Tidak ada objek jenis ini yang tersedia. Tambahkan lebih dulu di halaman Objek
              Penilaian.
            </p>
          ) : (
            <>
              <label className="admin-tools__field">
                <span>Tambahkan objek ke kategori ini</span>
                <span className="admin-tools__hint">
                  Pilih satu atau beberapa sekaligus — tahan Ctrl (⌘ di Mac) sambil mengeklik, atau
                  geser untuk memilih beberapa baris berurutan.
                </span>
                <select
                  name="objectIds"
                  multiple
                  size={Math.min(6, candidateObjects.length)}
                  className="form__control participant-add__select"
                >
                  {candidateObjects.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} — {o.ownerUnit.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={addPending} className="app-btn app-btn--primary">
                {addPending ? "Menambahkan…" : "Tambahkan sebagai peserta"}
              </button>
            </>
          )}
          {addState.error && (
            <p role="alert" className="participant-add__error">
              {addState.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
