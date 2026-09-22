"use client";

import { useState } from "react";
import { useAksi } from "@/components/theme/notifikasi";
import { AdminAction } from "@/components/theme/admin-actions";
import { DataList, DataRow, RowField, RowTitle } from "@/components/theme/data-list";
import { PilihanCariBanyak } from "@/components/theme/pilihan-cari";
import { TombolHapus } from "@/components/theme/tombol-hapus";
import {
  createObjectGroupAction,
  updateObjectGroupAction,
  deleteObjectGroupAction,
} from "@/lib/actions/admin-object-groups";

/**
 * Kelompok objek: daftar objek bernama yang dipakai ulang saat menyusun peserta kategori.
 *
 * Penyaring yang sudah ada hanya bisa "semua objek dari satu unit", sedangkan sekumpulan objek
 * yang tersebar di banyak unit — finalis sebuah lomba, misalnya — harus dicentang satu per satu
 * setiap kali kategori serupa dibuat. Kelompok menyimpan susunan itu sekali.
 */

export interface AnggotaKelompok {
  id: string;
  name: string;
  typeName: string;
  typeId: string;
  unitName: string;
  active: boolean;
}

export interface KelompokObjek {
  id: string;
  name: string;
  description: string | null;
  members: AnggotaKelompok[];
}

const fieldClass = "form__control";

export function ObjectGroupManager({
  groups,
  objects,
}: {
  groups: KelompokObjek[];
  objects: { id: string; name: string; typeName: string; unitName: string; active: boolean }[];
}) {
  const [tambahState, tambahAction, tambahPending] = useAksi(createObjectGroupAction, {}, "Kelompok objek dibuat.");
  const [pilihanBaru, setPilihanBaru] = useState<string[]>([]);
  const opsi = objects
    .filter((o) => o.active)
    .map((o) => ({ value: o.id, label: `${o.name} — ${o.typeName}, ${o.unitName}` }));

  return (
    <AdminAction
      name="Kelola kelompok objek"
      description="Daftar objek yang dapat dipilih bersama saat menyusun peserta kategori."
    >
          <form action={tambahAction} className="grid gap-3">
            <label className="admin-tools__field">
              <span>Nama kelompok</span>
              <input name="name" placeholder="mis. Finalis Got Talent 2026" required className={fieldClass} />
            </label>
            <label className="admin-tools__field">
              <span>Keterangan (opsional)</span>
              <input name="description" placeholder="Dipakai untuk apa" className={fieldClass} />
            </label>
            <label className="admin-tools__field">
              <span>Anggota</span>
              <PilihanCariBanyak
                name="objectIds"
                aria-label="Objek anggota kelompok"
                value={pilihanBaru}
                onChange={setPilihanBaru}
                options={opsi}
              />
            </label>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={tambahPending} className="app-btn app-btn--primary">
                {tambahPending ? "Menyimpan…" : "Simpan kelompok"}
              </button>
              {tambahState.error && (
                <p role="alert" className="aturan-galat">
                  {tambahState.error}
                </p>
              )}
            </div>
          </form>

      {groups.length === 0 ? (
        <p className="app-empty">Belum ada kelompok objek.</p>
      ) : (
        <DataList
          columnHeaderHidden={false}
          columns={[
            ["title", "Kelompok"],
            ["topic", "Anggota"],
            ["location", "Jenis objek"],
            ["price", "Aksi"],
          ]}
        >
          {groups.map((g) => (
            <BarisKelompok key={g.id} group={g} opsi={opsi} />
          ))}
        </DataList>
      )}
    </AdminAction>
  );
}

function BarisKelompok({
  group,
  opsi,
}: {
  group: KelompokObjek;
  opsi: { value: string; label: string }[];
}) {
  const [ubah, setUbah] = useState(false);
  const [pilihan, setPilihan] = useState(group.members.map((m) => m.id));
  const [state, formAction, pending] = useAksi(updateObjectGroupAction, {}, "Kelompok objek disimpan.");
  const jenis = [...new Set(group.members.map((m) => m.typeName))];

  return (
    <DataRow
      collapsible
      panel={
        <div className="admin-row-panel">
          {ubah ? (
            <form action={formAction} className="grid gap-3">
              <input type="hidden" name="groupId" value={group.id} />
              <label className="admin-tools__field">
                <span>Nama kelompok</span>
                <input name="name" defaultValue={group.name} required className={fieldClass} />
              </label>
              <label className="admin-tools__field">
                <span>Keterangan</span>
                <input name="description" defaultValue={group.description ?? ""} className={fieldClass} />
              </label>
              <label className="admin-tools__field">
                <span>Anggota</span>
                <PilihanCariBanyak
                  name="objectIds"
                  aria-label="Objek anggota kelompok"
                  value={pilihan}
                  onChange={setPilihan}
                  options={opsi}
                />
              </label>
              <div className="flex items-center gap-2">
                <button type="submit" disabled={pending} className="app-btn app-btn--primary">
                  {pending ? "Menyimpan…" : "Simpan"}
                </button>
                <button type="button" className="app-btn" onClick={() => setUbah(false)}>
                  Batal
                </button>
                {state.error && (
                  <p role="alert" className="aturan-galat">
                    {state.error}
                  </p>
                )}
              </div>
            </form>
          ) : (
            <>
              {group.description && <p className="app-panel__text">{group.description}</p>}
              {group.members.length === 0 ? (
                <p className="app-text-sm">Belum ada anggota.</p>
              ) : (
                <ul className="kelompok-anggota">
                  {group.members.map((m) => (
                    <li key={m.id}>
                      <span>{m.name}</span>
                      <span className="kelompok-anggota__unit">
                        {m.typeName} · {m.unitName}
                        {!m.active && " · nonaktif"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-2">
                <button type="button" className="app-btn" onClick={() => setUbah(true)}>
                  Ubah kelompok
                </button>
                <TombolHapus
                  aksi={deleteObjectGroupAction}
                  id={group.id}
                  label="Hapus kelompok"
                  judul={`Hapus kelompok ${group.name}?`}
                  pesan={
                    <p>
                      Kelompok hanya pintasan memilih objek. Objek beserta seluruh penilaiannya
                      tidak tersentuh.
                    </p>
                  }
                  berhasil="Kelompok objek dihapus."
                />
              </div>
            </>
          )}
        </div>
      }
    >
      <RowTitle>{group.name}</RowTitle>
      <RowField kind="topic" icon={false}>
        {group.members.length} objek
      </RowField>
      <RowField kind="location" icon={false}>
        {jenis.length ? jenis.join(", ") : "—"}
      </RowField>
    </DataRow>
  );
}
