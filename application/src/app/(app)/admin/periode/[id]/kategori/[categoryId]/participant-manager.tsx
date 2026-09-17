"use client";

import { useAksi, useAksiLangsung } from "@/components/theme/notifikasi";
import { useMemo, useState } from "react";
import { addCategoryObjectsAction, removeCategoryObjectAction } from "@/lib/actions/admin-categories";
import type { getCategoryDetail } from "@/lib/services/categories";
import { PilihanCari, PilihanCariBanyak } from "@/components/theme/pilihan-cari";
import { AlasanBerjalan } from "@/components/theme/alasan-berjalan";

type Participant = NonNullable<Awaited<ReturnType<typeof getCategoryDetail>>>["categoryObjects"][number];
type CandidateObject = { id: string; name: string; ownerUnitId: string; ownerUnit: { name: string } };
type Unit = { id: string; name: string; parentId: string | null };

/** Untuk tiap unit: objek calon yang dimiliki unit itu atau salah satu sub-unitnya. */
function kelompokkanPerUnit(candidateObjects: CandidateObject[], units: Unit[]) {
  const induk = new Map(units.map((u) => [u.id, u.parentId]));
  const perUnit = new Map<string, string[]>();
  for (const o of candidateObjects) {
    const dilihat = new Set<string>();
    for (let u: string | null | undefined = o.ownerUnitId; u && !dilihat.has(u); u = induk.get(u)) {
      dilihat.add(u);
      perUnit.set(u, [...(perUnit.get(u) ?? []), o.id]);
    }
  }
  return perUnit;
}

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
  units,
  objectTypeName,
  editable,
  bisaTambah,
  berjalan,
}: {
  periodId: string;
  categoryId: string;
  participants: Participant[];
  candidateObjects: CandidateObject[];
  units: Unit[];
  objectTypeName: string;
  /** Boleh mengeluarkan objek (hanya saat Draf). */
  editable: boolean;
  /** Boleh menambah objek — saat Draf, dan saat Aktif sebelum tenggat. */
  bisaTambah: boolean;
  /** Periode sedang Aktif: penambahan butuh alasan. */
  berjalan: boolean;
}) {
  const keluarkanObjek = useAksiLangsung(removeCategoryObjectAction, "Objek dikeluarkan dari kategori.");
  const [addState, addFormAction, addPending] = useAksi(addCategoryObjectsAction, {}, (_h, fd) => `${fd.getAll("objectIds").length} objek ditambahkan ke kategori.`);
  const [terpilih, setTerpilih] = useState<string[]>([]);
  const perUnit = useMemo(() => kelompokkanPerUnit(candidateObjects, units), [candidateObjects, units]);
  const opsiUnit = units
    .filter((u) => perUnit.has(u.id))
    .map((u) => ({ value: u.id, label: `${u.name} (${perUnit.get(u.id)!.length})` }));
  // Objek yang sudah jadi peserta hilang dari daftar calon setelah ditambahkan; pilihan lama ikut dibuang.
  const idCalon = new Set(candidateObjects.map((o) => o.id));
  const pilihan = terpilih.filter((id) => idCalon.has(id));
  const tambahkan = (ids: string[]) => setTerpilih([...pilihan, ...ids.filter((id) => !pilihan.includes(id))]);
  const semuaTerpilih = pilihan.length === candidateObjects.length;

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
                <form action={keluarkanObjek} className="participant-list__action">
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

      {bisaTambah && (
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
                  Ketik nama untuk mencari; boleh memilih beberapa sekaligus, atau pakai pilih cepat
                  di bawah.
                </span>
                <PilihanCariBanyak
                  name="objectIds"
                  value={pilihan}
                  onChange={setTerpilih}
                  options={candidateObjects.map((o) => ({ value: o.id, label: `${o.name} — ${o.ownerUnit.name}` }))}
                />
              </label>
              <div className="participant-add__cepat">
                <span className="participant-add__cepat-label">Pilih cepat</span>
                <button
                  type="button"
                  className="app-btn app-btn--polos"
                  disabled={semuaTerpilih}
                  onClick={() => tambahkan(candidateObjects.map((o) => o.id))}
                >
                  Semua {objectTypeName.toLowerCase()} ({candidateObjects.length})
                </button>
                {opsiUnit.length > 1 && (
                  <span className="participant-add__unit">
                    <PilihanCari
                      aria-label="Pilih semua objek dari unit"
                      value=""
                      onChange={(unitId) => unitId && tambahkan(perUnit.get(unitId) ?? [])}
                      kosong={{ label: "Semua dari unit…", bisaDipilih: false }}
                      options={opsiUnit}
                    />
                  </span>
                )}
                {pilihan.length > 0 && (
                  <button type="button" className="app-btn app-btn--polos" onClick={() => setTerpilih([])}>
                    Kosongkan
                  </button>
                )}
              </div>
              {berjalan && pilihan.length > 0 && (
                <AlasanBerjalan contoh="Mis. dosen baru bergabung setelah periode dibuka" />
              )}
              {pilihan.length > 0 && (
                <p className="participant-add__ringkas" aria-live="polite">
                  {pilihan.length} dari {candidateObjects.length} objek dipilih.
                </p>
              )}
              <button
                type="submit"
                disabled={addPending || pilihan.length === 0}
                className="app-btn app-btn--primary"
              >
                {addPending
                  ? "Menambahkan…"
                  : pilihan.length > 0
                    ? `Tambahkan ${pilihan.length} objek sebagai peserta`
                    : "Tambahkan sebagai peserta"}
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
