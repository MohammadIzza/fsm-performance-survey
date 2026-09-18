"use client";

import { startTransition, useEffect, useId, useRef, useState } from "react";
import { useAksi } from "@/components/theme/notifikasi";
import { useKonfirmasi } from "@/components/theme/confirm-dialog";
import {
  ScoreField,
  displayNumber,
  type ParameterView,
  type Scale,
} from "../../[assignmentId]/assignment-form";
import {
  saveCategoryDraftAction,
  submitCategoryAction,
  type KategoriFormState,
} from "@/lib/actions/responses";
import { DialogLembar } from "./dialog-lembar";

/**
 * Lembar penilaian satu kategori, diisi PER PERTANYAAN.
 *
 * Satu layar = satu parameter beserta seluruh objek yang dinilai. Penilai memberi skor "Baju rapi"
 * untuk semua dosen sekaligus, baru pindah ke "sepatu hitam" — jadi satu kriteria dibandingkan
 * antarobjek dalam satu pandangan, bukan satu orang dinilai untuk semua kriteria lalu pindah ke
 * orang berikutnya dengan patokan yang sudah bergeser.
 *
 * Aturannya:
 *   - Berikutnya baru bisa ditekan bila semua objek pada pertanyaan itu sudah diberi skor.
 *   - Setiap pindah pertanyaan, isian disimpan diam-diam sebagai draf, supaya HP yang mati atau
 *     tab yang tertutup tidak memaksa penilai mengulang dari awal. Saat dibuka lagi, lembar
 *     langsung melompat ke pertanyaan pertama yang belum selesai.
 *   - Setelah pertanyaan terakhir ada ringkasan seluruh skor, dan dari sanalah semua objek
 *     dikirim sekaligus — pada titik itu semuanya pasti lengkap.
 *   - Objek yang sudah terkirim sebelumnya tidak ditanyakan lagi; ia hanya muncul di ringkasan.
 *
 * Di server tugasnya tetap satu per objek: status, draf, dan riwayat revisi melekat per objek.
 */

export interface BarisObjek {
  assignmentId: string;
  objectName: string;
  unitName: string | null;
  displayStatus: string;
  bolehDiisi: boolean;
  scores: Record<string, number>;
  version: number | null;
}

const statusLabel: Record<string, string> = {
  BELUM_MULAI: "Belum mulai",
  DRAF: "Draf",
  TERKIRIM: "Terkirim",
  DIBUKA_KEMBALI: "Dibuka kembali",
  LEWAT_TENGGAT: "Lewat tenggat",
};


const kirimAwal: KategoriFormState = {};

type KeadaanSimpan = "diam" | "menyimpan" | "tersimpan" | "gagal";

export function LembarKategori({
  parameters,
  scale,
  guide,
  baris,
}: {
  parameters: ParameterView[];
  scale: Scale;
  guide: string | null;
  baris: BarisObjek[];
}) {
  const urut = parameters.slice().sort((a, b) => a.order - b.order);
  const bisaDiisi = baris.filter((b) => b.bolehDiisi);
  const terkunci = baris.filter((b) => !b.bolehDiisi);

  const [kirimState, kirimAction, kirimPending] = useAksi(submitCategoryAction, kirimAwal, null);
  const [konfirmasi, dialogKonfirmasi] = useKonfirmasi();
  const idLembar = useId();
  const [dialogDitutup, setDialogDitutup] = useState<string | null>(null);

  // Kunci idempotensi dibuat sekali per pemuatan halaman, satu untuk tiap objek (Bab 11.4).
  const [kunci] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      baris.map((b) => [
        b.assignmentId,
        typeof crypto !== "undefined" ? crypto.randomUUID() : `${b.assignmentId}-${Date.now()}`,
      ])
    )
  );

  const [nilai, setNilai] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(
      baris.map((b) => [
        b.assignmentId,
        Object.fromEntries(urut.map((p) => [p.id, b.scores[p.id] != null ? String(b.scores[p.id]) : ""])),
      ])
    )
  );

  const terisi = (assignmentId: string, parameterId: string) =>
    (nilai[assignmentId]?.[parameterId] ?? "") !== "";
  const kurangPada = (parameterId: string) => bisaDiisi.filter((b) => !terisi(b.assignmentId, parameterId)).length;

  // Dibuka lagi setelah terputus: mulai dari pertanyaan pertama yang belum selesai. Tanpa objek yang
  // bisa diisi sama sekali, langsung ke ringkasan.
  const [langkah, setLangkah] = useState(() => {
    if (bisaDiisi.length === 0) return urut.length;
    const i = urut.findIndex((p) => bisaDiisi.some((b) => b.scores[p.id] == null));
    return i === -1 ? urut.length : i;
  });
  const diRingkasan = langkah >= urut.length;

  // Simpan diam-diam. Kiriman diantrekan satu per satu: versi draf dari simpanan sebelumnya harus
  // sudah kembali sebelum simpanan berikutnya berangkat, kalau tidak server menolaknya sebagai
  // perubahan yang bentrok. Nilai dan versi dibaca lewat ref supaya yang terkirim selalu yang terakhir.
  const nilaiRef = useRef(nilai);
  const versiRef = useRef<Record<string, number | null>>(
    Object.fromEntries(baris.map((b) => [b.assignmentId, b.version]))
  );
  const antrean = useRef<Promise<void>>(Promise.resolve());
  const [simpan, setSimpan] = useState<KeadaanSimpan>("diam");
  const kotor = useRef(false);

  // Ref dan state diperbarui bersama di satu tempat: ref yang dibaca simpanan diam, state yang
  // dirender. Keduanya tidak boleh berbeda, dan ref tidak boleh ditulis saat render.
  function ubahNilai(assignmentId: string, parameterId: string, v: string) {
    kotor.current = true;
    const berikut = {
      ...nilaiRef.current,
      [assignmentId]: { ...nilaiRef.current[assignmentId], [parameterId]: v },
    };
    nilaiRef.current = berikut;
    setNilai(berikut);
  }

  function isianLembar() {
    const fd = new FormData();
    for (const b of bisaDiisi) {
      fd.append("tugas", b.assignmentId);
      fd.append(`nama.${b.assignmentId}`, b.objectName);
      fd.append(`kunci.${b.assignmentId}`, kunci[b.assignmentId]);
      fd.append(`versi.${b.assignmentId}`, String(versiRef.current[b.assignmentId] ?? ""));
      for (const p of urut) fd.append(`skor.${b.assignmentId}.${p.id}`, nilaiRef.current[b.assignmentId]?.[p.id] ?? "");
    }
    return fd;
  }

  function simpanDiam() {
    if (!kotor.current || bisaDiisi.length === 0) return antrean.current;
    kotor.current = false;
    antrean.current = antrean.current
      .then(async () => {
        setSimpan("menyimpan");
        const hasil = await saveCategoryDraftAction({}, isianLembar());
        if (hasil.versions) versiRef.current = { ...versiRef.current, ...hasil.versions };
        setSimpan(hasil.error || (hasil.ringkasan?.gagal.length ?? 0) > 0 ? "gagal" : "tersimpan");
      })
      .catch(() => setSimpan("gagal"));
    return antrean.current;
  }

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (kotor.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  function pindah(ke: number) {
    void simpanDiam();
    setLangkah(ke);
    // Pertanyaan baru dimulai dari atas, bukan dari posisi gulir pertanyaan sebelumnya.
    document.getElementById(idLembar)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function total(b: BarisObjek) {
    const isi = nilai[b.assignmentId] ?? {};
    if (!urut.some((p) => (isi[p.id] ?? "") !== "")) return "—";
    return displayNumber(
      urut.reduce((s, p) => {
        const n = Number(isi[p.id]);
        return s + (Number.isFinite(n) ? (n * p.weight) / 100 : 0);
      }, 0)
    );
  }

  async function kirimSemua() {
    const ya = await konfirmasi({
      label: "Kirim penilaian",
      judul: `Kirim ${bisaDiisi.length} objek sekarang?`,
      pesan: (
        <p>
          Seluruh {urut.length} pertanyaan sudah dijawab untuk {bisaDiisi.length} objek. Setelah
          dikirim, jawabannya terkunci dan tidak dapat diubah lagi, jadi pastikan setiap skor sudah
          sesuai penilaian Anda.
        </p>
      ),
      tombolYa: "Kirim sekarang",
      tombolBatal: "Periksa lagi",
    });
    if (!ya) return;
    // Simpanan diam yang masih di jalan harus selesai dulu, supaya versi yang dikirim cocok.
    await antrean.current;
    const fd = isianLembar();
    kotor.current = false;
    startTransition(() => kirimAction(fd));
  }

  const ringkasan = kirimState.ringkasan;
  const dialogBuka = !!kirimState.submittedAt && dialogDitutup !== kirimState.submittedAt;
  const galatBaris = new Map((ringkasan?.gagal ?? []).map((g) => [g.assignmentId, g.pesan]));

  const pertanyaan = urut[langkah];
  const kurang = pertanyaan ? kurangPada(pertanyaan.id) : 0;
  const semuaLengkap = bisaDiisi.every((b) => urut.every((p) => terisi(b.assignmentId, p.id)));

  const hanyaBaca = bisaDiisi.length === 0;
  const keterangan = hanyaBaca
    ? "Seluruh jawaban sudah terkirim — halaman ini hanya untuk dilihat."
    : kurang > 0
      ? `${kurang} objek belum diberi skor — lengkapi dulu untuk lanjut.`
      : simpan === "menyimpan"
        ? "Menyimpan…"
        : simpan === "tersimpan"
          ? "Tersimpan otomatis sebagai draf."
          : simpan === "gagal"
            ? "Gagal menyimpan draf — isian masih ada di layar, coba lanjutkan lagi."
            : "";

  return (
    <div className="lembar-kategori space-y-6" id={idLembar}>
      {/* Penanda kemajuan: satu titik per pertanyaan, ditambah ringkasan di ujungnya. Pertanyaan
          yang sudah selesai boleh dibuka lagi lewat titiknya; yang belum dijangkau hanya lewat
          Berikutnya — urutannya tetap satu per satu. */}
      <ol className="lembar-langkah" aria-label="Kemajuan pengisian">
        {urut.map((p, i) => {
          // Selesai = setiap objek, termasuk yang sudah terkirim sebelumnya, punya skor untuk
          // pertanyaan ini. Dulu hanya objek yang masih bisa diisi yang dihitung, sehingga kategori
          // yang seluruh objeknya sudah terkirim justru tampil seperti belum dikerjakan.
          const selesai = baris.length > 0 && baris.every((b) => terisi(b.assignmentId, p.id));
          // Pertanyaan yang sudah selesai selalu bisa dibuka — juga setelah semua objeknya terkirim,
          // untuk melihat kembali skor yang pernah diberikan (hanya dibaca). Yang belum selesai
          // hanya bisa dijangkau berurutan lewat Berikutnya.
          const bisaDibuka = selesai || (bisaDiisi.length > 0 && i <= langkah);
          const keadaan = i === langkah ? "aktif" : selesai ? "selesai" : "belum";
          return (
            <li key={p.id} data-keadaan={keadaan} data-selesai={selesai ? "true" : undefined}>
              <button
                type="button"
                className="lembar-langkah__langkah"
                aria-current={i === langkah ? "step" : undefined}
                aria-label={`Pertanyaan ${i + 1}: ${p.name}`}
                disabled={!bisaDibuka}
                onClick={() => pindah(i)}
              >
                <span className="lembar-langkah__titik" data-keadaan={keadaan}>
                  {i + 1}
                </span>
                <span className="lembar-langkah__label">{p.name}</span>
              </button>
            </li>
          );
        })}
        <li className="lembar-langkah__ringkasan" data-keadaan={diRingkasan ? "aktif" : "belum"}>
          <button
            type="button"
            className="lembar-langkah__langkah"
            aria-current={diRingkasan ? "step" : undefined}
            aria-label="Ringkasan"
            disabled={!semuaLengkap}
            onClick={() => pindah(urut.length)}
          >
            {/* Ringkasan berbentuk titik yang sama dengan pertanyaan — tanda centang di dalamnya,
                namanya di bawah — supaya deretnya berirama rata dan tidak ada pil lebar yang
                berdesakan dengan titik terakhir di layar ponsel. */}
            <span
              className="lembar-langkah__titik"
              data-keadaan={diRingkasan ? "aktif" : bisaDiisi.length === 0 ? "selesai" : "belum"}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="lembar-langkah__centang">
                <path d="M5 12.5l4.2 4.2L19 7" />
              </svg>
            </span>
            <span className="lembar-langkah__label">Ringkasan</span>
          </button>
        </li>
      </ol>

      {!diRingkasan && pertanyaan && (
        <section className="app-panel" aria-labelledby="judul-pertanyaan">
          <header className="lembar-pertanyaan__kepala">
            <p className="eyebrow">
              PERTANYAAN {langkah + 1} DARI {urut.length}
            </p>
            <div className="lembar-pertanyaan__judul">
              <h2 id="judul-pertanyaan">{pertanyaan.name}</h2>
              <span className="lembar-pertanyaan__bobot">{pertanyaan.weight}%</span>
            </div>
            {pertanyaan.indicator && <p className="lembar-pertanyaan__indikator">{pertanyaan.indicator}</p>}
            {guide && (
              <details className="lembar-pertanyaan__petunjuk">
                <summary>Petunjuk penilaian</summary>
                <p>{guide}</p>
              </details>
            )}
          </header>

          <table className="lembar-soal">
            <thead>
              <tr>
                <th scope="col">Objek yang dinilai</th>
                <th scope="col">
                  Skor {displayNumber(scale.min)}–{displayNumber(scale.max)}
                </th>
              </tr>
            </thead>
            <tbody>
              {bisaDiisi.map((b) => (
                <tr key={b.assignmentId}>
                  <td>
                    {b.objectName}
                    {b.unitName && <small>{b.unitName}</small>}
                  </td>
                  <td className="lembar-soal__skor">
                    <ScoreField
                      id={`skor-${b.assignmentId}-${pertanyaan.id}`}
                      label={`${pertanyaan.name} untuk ${b.objectName}`}
                      scale={scale}
                      value={nilai[b.assignmentId]?.[pertanyaan.id] ?? ""}
                      onChange={(v) => ubahNilai(b.assignmentId, pertanyaan.id, v)}
                      disabled={false}
                    />
                  </td>
                </tr>
              ))}
              {/* Objek yang sudah terkirim: skornya ditampilkan sebagai angka biasa, bukan kotak
                  isian — bisa dilihat kembali, tidak bisa diubah. */}
              {terkunci.map((b) => {
                const v = nilai[b.assignmentId]?.[pertanyaan.id] ?? "";
                return (
                  <tr key={b.assignmentId} data-terkunci="true">
                    <td>
                      {b.objectName}
                      {b.unitName && <small>{b.unitName}</small>}
                      <small className="lembar-ringkasan__status" data-status={b.displayStatus}>
                        {b.displayStatus === "TERKIRIM"
                          ? "Sudah terkirim"
                          : (statusLabel[b.displayStatus] ?? b.displayStatus)}
                      </small>
                    </td>
                    <td className="lembar-soal__skor lembar-soal__skor--baca">
                      {v === "" ? "—" : displayNumber(Number(v))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="lembar-aksi">
            <p className="lembar-aksi__keterangan" role="status" aria-live="polite">
              {keterangan}
            </p>
            <div className="lembar-aksi__tombol">
              <button
                type="button"
                className="app-btn"
                disabled={langkah === 0}
                onClick={() => pindah(langkah - 1)}
              >
                ← Sebelumnya
              </button>
              <button
                type="button"
                className="app-btn app-btn--primary"
                disabled={kurang > 0}
                onClick={() => pindah(langkah + 1)}
              >
                {langkah + 1 === urut.length ? "Lihat ringkasan →" : "Berikutnya →"}
              </button>
            </div>
          </div>
        </section>
      )}

      {diRingkasan && (
        <section className="app-panel" aria-labelledby="judul-ringkasan">
          <header className="lembar-pertanyaan__kepala">
            <p className="eyebrow">RINGKASAN</p>
            <div className="lembar-pertanyaan__judul">
              <h2 id="judul-ringkasan">
                {bisaDiisi.length > 0 ? "Periksa sebelum mengirim" : "Seluruh objek sudah terkirim"}
              </h2>
            </div>
            {bisaDiisi.length > 0 && (
              <p className="lembar-pertanyaan__indikator">
                Ketuk titik pertanyaannya di atas untuk mengubah sebuah jawaban.
              </p>
            )}
          </header>

          <div className="app-table-wrap">
            <table className="lembar-ringkasan">
              <thead>
                <tr>
                  <th scope="col">Objek</th>
                  {/* Nama pertanyaan di layar lebar, nomornya di ponsel (kolomnya hanya ±40px), dan
                      bobot di bawah keduanya — bobot itulah yang menjelaskan kenapa nilai akhir bisa
                      jauh dari rata-rata skornya. */}
                  {urut.map((p, i) => (
                    <th scope="col" key={p.id} title={`${p.name} · bobot ${p.weight}%`}>
                      <span className="lembar-ringkasan__nama">{p.name}</span>
                      <span className="lembar-ringkasan__nomor">{i + 1}</span>
                      <small className="lembar-ringkasan__bobot">{p.weight}%</small>
                    </th>
                  ))}
                  <th scope="col">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {[...bisaDiisi, ...terkunci].map((b) => {
                  const galat = galatBaris.get(b.assignmentId);
                  return (
                    <tr key={b.assignmentId} data-terkunci={b.bolehDiisi ? undefined : "true"}>
                      <td>
                        {b.objectName}
                        {b.unitName && <small>{b.unitName}</small>}
                        {/* Objek yang tidak ikut dikirim dari halaman ini — sudah terkirim sebelumnya
                            atau tidak bisa diisi lagi — ditandai teks berwarna, supaya tidak dikira
                            ikut terkirim bersama baris di atasnya. */}
                        {!b.bolehDiisi && (
                          <small className="lembar-ringkasan__status" data-status={b.displayStatus}>
                            {b.displayStatus === "TERKIRIM"
                              ? "Sudah terkirim"
                              : (statusLabel[b.displayStatus] ?? b.displayStatus)}
                          </small>
                        )}
                        {galat && (
                          <small role="alert" className="lembar-ringkasan__galat">
                            {galat}
                          </small>
                        )}
                      </td>
                      {urut.map((p) => {
                        const v = nilai[b.assignmentId]?.[p.id] ?? "";
                        return <td key={p.id}>{v === "" ? "—" : displayNumber(Number(v))}</td>;
                      })}
                      <td className="lembar-ringkasan__nilai">{total(b)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {bisaDiisi.length > 0 && (
            <div className="lembar-aksi">
              <p className="lembar-aksi__keterangan" role="alert">
                {kirimState.error ?? ""}
              </p>
              <div className="lembar-aksi__tombol">
                <button
                  type="button"
                  className="app-btn"
                  disabled={kirimPending}
                  onClick={() => pindah(urut.length - 1)}
                >
                  ← Kembali
                </button>
                <button
                  type="button"
                  className="app-btn app-btn--primary"
                  disabled={kirimPending}
                  onClick={kirimSemua}
                >
                  {kirimPending ? "Mengirim…" : `Kirim jawaban (${bisaDiisi.length})`}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {dialogKonfirmasi}
      <DialogLembar
        buka={dialogBuka}
        terkirim={ringkasan?.terkirim ?? 0}
        draf={ringkasan?.draf ?? 0}
        gagal={ringkasan?.gagal.length ?? 0}
        onTutup={() => setDialogDitutup(kirimState.submittedAt ?? null)}
      />
    </div>
  );
}
