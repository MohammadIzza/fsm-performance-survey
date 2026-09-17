"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { CategoryTabs } from "../periode/[id]/kategori/[categoryId]/category-tabs";

type Penilai = { id: string; nama: string; login: string; unit: string | null; aktif: boolean; belumMulai: number; draf: number; terkirim: number };
type Kelompok = { kelompok: "PIMPINAN" | "SELAIN_PIMPINAN"; minimum: number; terkirim: number; ditugaskan: number };
type Objek = { categoryId: string; kategori: string; objek: string; unit: string; kelompok: Kelompok[] };

const BATAS = 10;
const namaKelompok = (k: Kelompok["kelompok"]) => (k === "PIMPINAN" ? "Pimpinan" : "Selain pimpinan");
/** Daftar dengan batas tampil dan tombol "tampilkan semua". */
function Terbatas<T>({ data, kosong, render }: { data: T[]; kosong: string; render: (tampil: T[]) => ReactNode }) {
  const [semua, setSemua] = useState(false);
  if (data.length === 0) return <p className="app-empty">{kosong}</p>;
  return (
    <>
      {render(semua ? data : data.slice(0, BATAS))}
      {data.length > BATAS && (
        <button type="button" className="app-btn app-btn--polos pantau-lagi" onClick={() => setSemua((s) => !s)}>
          {semua ? "Tampilkan lebih sedikit" : `Tampilkan semua ${data.length}`}
        </button>
      )}
    </>
  );
}

function Petunjuk({ children }: { children: ReactNode }) {
  return <p className="pantau-petunjuk">{children}</p>;
}

export function TindakLanjut({
  periodeId,
  bisaTambah,
  penilai,
  objek,
  bagian,
}: {
  periodeId: string;
  bisaTambah: boolean;
  penilai: Penilai[];
  objek: Objek[];
  bagian?: string;
}) {
  const [cari, setCari] = useState("");
  const penilaiCocok = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return q ? penilai.filter((p) => `${p.nama} ${p.login} ${p.unit ?? ""}`.toLowerCase().includes(q)) : penilai;
  }, [penilai, cari]);

  // Objek yang penilainya memang kurang ditugaskan butuh tindakan admin; sisanya tinggal menunggu.
  const perluPenilai = objek.filter((o) => o.kelompok.some((k) => k.ditugaskan < k.minimum));
  const menunggu = objek.filter((o) => !perluPenilai.includes(o));
  const tautanPenugasan = (o: Objek) => `/admin/periode/${periodeId}/kategori/${o.categoryId}?bagian=penugasan`;

  const tabs = [
    {
      key: "tambah-penilai",
      label: "Perlu penilai tambahan",
      count: perluPenilai.length,
      content: (
        <>
          <Petunjuk>
            Penilai yang ditugaskan untuk objek ini lebih sedikit dari minimum, jadi objeknya tidak akan bisa masuk
            peringkat walau semua penilai sudah mengisi.
            {!bisaTambah && " Penilai hanya bisa ditambah saat periode Draf atau sedang berjalan."}
          </Petunjuk>
          <Terbatas
            data={perluPenilai}
            kosong="Semua objek sudah punya cukup penilai."
            render={(tampil) => (
              <div className="app-table-wrap">
                <table className="pantau-tabel">
                  <thead>
                    <tr>
                      <th>Objek</th>
                      <th>Kategori</th>
                      <th>Kekurangan</th>
                      <th aria-label="Tindakan" />
                    </tr>
                  </thead>
                  <tbody>
                    {tampil.map((o) => (
                      <tr key={`${o.categoryId}|${o.objek}`}>
                        <td data-label="Objek">
                          <strong>{o.objek}</strong>
                          <small>{o.unit}</small>
                        </td>
                        <td data-label="Kategori">{o.kategori}</td>
                        <td data-label="Kekurangan">
                          {o.kelompok
                            .filter((k) => k.ditugaskan < k.minimum)
                            .map((k) => (
                              <span key={k.kelompok} className="pantau-baris">
                                {namaKelompok(k.kelompok)}: {k.ditugaskan} dari {k.minimum} penilai
                              </span>
                            ))}
                        </td>
                        <td className="pantau-tabel__aksi">
                          {bisaTambah && (
                            <Link href={tautanPenugasan(o)} className="pantau-tautan">
                              Tambah penilai →
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          />
        </>
      ),
    },
    {
      key: "penilai",
      label: "Penilai belum selesai",
      count: penilai.length,
      content: (
        <>
          <Petunjuk>Orang yang masih punya tugas belum dikirim. Draf sudah diisi sebagian, tetapi belum dihitung sampai dikirim.</Petunjuk>
          {penilai.length > BATAS && (
            <input
              type="search"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama, NIP/NIM, atau unit…"
              aria-label="Cari penilai"
              className="form__control pantau-cari"
            />
          )}
          <Terbatas
            data={penilaiCocok}
            kosong={penilai.length ? "Tidak ada penilai yang cocok." : "Semua penilai sudah mengirim seluruh tugasnya."}
            render={(tampil) => (
              <div className="app-table-wrap">
                <table className="pantau-tabel">
                  <thead>
                    <tr>
                      <th>Penilai</th>
                      <th>Unit</th>
                      <th className="pantau-tabel__angka">Belum dikirim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tampil.map((p) => (
                      <tr key={p.id}>
                        <td data-label="Penilai">
                          <strong>{p.nama}</strong>
                          <small>
                            {p.login}
                            {!p.aktif && " · akun nonaktif"}
                          </small>
                        </td>
                        <td data-label="Unit">{p.unit ?? "—"}</td>
                        <td data-label="Belum dikirim" className="pantau-tabel__angka">
                          <strong>
                            {p.belumMulai + p.draf} tugas<span className="pantau-seluler"> belum dikirim</span>
                          </strong>
                          <small>{p.draf > 0 ? `${p.draf} di antaranya draf` : "belum dibuka"}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          />
        </>
      ),
    },
    {
      key: "menunggu",
      label: "Menunggu penilaian",
      count: menunggu.length,
      content: (
        <>
          <Petunjuk>Penilainya sudah cukup, tetapi yang sudah mengirim belum mencapai minimum. Cukup ingatkan penilainya.</Petunjuk>
          <Terbatas
            data={menunggu}
            kosong="Tidak ada objek yang menunggu penilaian."
            render={(tampil) => (
              <div className="app-table-wrap">
                <table className="pantau-tabel">
                  <thead>
                    <tr>
                      <th>Objek</th>
                      <th>Kategori</th>
                      <th>Sudah dikirim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tampil.map((o) => (
                      <tr key={`${o.categoryId}|${o.objek}`}>
                        <td data-label="Objek">
                          <strong>{o.objek}</strong>
                          <small>{o.unit}</small>
                        </td>
                        <td data-label="Kategori">{o.kategori}</td>
                        <td data-label="Sudah dikirim">
                          {o.kelompok.map((k) => (
                            <span key={k.kelompok} className="pantau-baris">
                              {namaKelompok(k.kelompok)}: {k.terkirim} dari minimum {k.minimum}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          />
        </>
      ),
    },
  ];

  const awal = tabs.some((t) => t.key === bagian) ? bagian : tabs.find((t) => t.count > 0)?.key;
  return <CategoryTabs tabs={tabs} initialKey={awal} />;
}
