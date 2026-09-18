"use client";

import { startTransition, useEffect, useId, useRef, useState } from "react";
import { useAksi } from "@/components/theme/notifikasi";
import { ThemeButton } from "@/components/theme-button";
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
          dikirim, jawabannya terkunci dan hanya bisa diubah lewat admin.
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

  return (
    <div className="lembar-kategori" id={idLembar}>
      {/* Kemajuan: satu penanda per pertanyaan, ditambah ringkasan di ujungnya. Pertanyaan yang
          sudah selesai boleh dibuka lagi lewat penandanya; yang belum, hanya lewat Berikutnya. */}
      <ol className="lembar-langkah" aria-label="Kemajuan pengisian">
        {urut.map((p, i) => {
          const selesai = bisaDiisi.length > 0 && kurangPada(p.id) === 0;
          const bisaDibuka = selesai || i <= langkah;
          return (
            <li key={p.id}>
              <button
                type="button"
                className="lembar-langkah__titik"
                data-keadaan={i === langkah ? "aktif" : selesai ? "selesai" : "belum"}
                aria-current={i === langkah ? "step" : undefined}
                disabled={!bisaDibuka || bisaDiisi.length === 0}
                onClick={() => pindah(i)}
                title={p.name}
              >
                {i + 1}
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className="lembar-langkah__titik lembar-langkah__titik--ringkasan"
            data-keadaan={diRingkasan ? "aktif" : "belum"}
            aria-current={diRingkasan ? "step" : undefined}
            disabled={bisaDiisi.some((b) => urut.some((p) => !terisi(b.assignmentId, p.id)))}
            onClick={() => pindah(urut.length)}
          >
            Ringkasan
          </button>
        </li>
      </ol>

      {!diRingkasan && pertanyaan && (
        <section className="assessment-sheet lembar-pertanyaan" aria-labelledby="judul-pertanyaan">
          <header className="lembar-pertanyaan__kepala">
            <p className="eyebrow">
              PERTANYAAN {langkah + 1} DARI {urut.length}
            </p>
            <div className="lembar-pertanyaan__judul">
              <h2 id="judul-pertanyaan">{pertanyaan.name}</h2>
              <span className="lembar-instrumen__bobot">{pertanyaan.weight}%</span>
            </div>
            {pertanyaan.indicator && <p className="lembar-pertanyaan__indikator">{pertanyaan.indicator}</p>}
            {guide && langkah === 0 && (
              <details className="lembar-pertanyaan__petunjuk">
                <summary>Petunjuk penilaian</summary>
                <p>{guide}</p>
              </details>
            )}
          </header>

          <div className="app-table-wrap">
            <table className="lembar-tabel lembar-tabel--satu">
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
                    <th scope="row">
                      <span className="lembar-tabel__nama">{b.objectName}</span>
                      {b.unitName && <small className="lembar-tabel__unit">{b.unitName}</small>}
                    </th>
                    <td className="lembar-tabel__skor">
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
              </tbody>
            </table>
          </div>

          {terkunci.length > 0 && (
            <p className="lembar-pertanyaan__catatan">
              {terkunci.length} objek lain sudah terkirim sebelumnya dan tidak ditanyakan lagi.
            </p>
          )}

          <div className="lembar-navigasi">
            <button
              type="button"
              className="assessment-actions__draft tap-target"
              disabled={langkah === 0}
              onClick={() => pindah(langkah - 1)}
            >
              ← Sebelumnya
            </button>
            <ThemeButton
              type="button"
              className="assessment-actions__submit"
              disabled={kurang > 0}
              onClick={() => pindah(langkah + 1)}
            >
              {langkah + 1 === urut.length ? "Lihat ringkasan →" : "Berikutnya →"}
            </ThemeButton>
            <p className="lembar-navigasi__keterangan" role="status" aria-live="polite">
              {kurang > 0
                ? `${kurang} objek belum diberi skor — lengkapi dulu untuk lanjut.`
                : simpan === "menyimpan"
                  ? "Menyimpan…"
                  : simpan === "tersimpan"
                    ? "Tersimpan otomatis sebagai draf."
                    : simpan === "gagal"
                      ? "Gagal menyimpan draf — isian masih ada di layar, coba lanjutkan lagi."
                      : " "}
            </p>
          </div>
        </section>
      )}

      {diRingkasan && (
        <section className="assessment-sheet lembar-pertanyaan" aria-labelledby="judul-ringkasan">
          <header className="lembar-pertanyaan__kepala">
            <p className="eyebrow">RINGKASAN</p>
            <h2 id="judul-ringkasan">
              {bisaDiisi.length > 0 ? "Periksa sebelum mengirim" : "Seluruh objek sudah terkirim"}
            </h2>
            {bisaDiisi.length > 0 && (
              <p className="lembar-pertanyaan__indikator">
                Ketuk nomor pertanyaan di kepala kolom untuk mengubah jawabannya.
              </p>
            )}
          </header>

          <div className="app-table-wrap">
            <table className="lembar-tabel">
              <thead>
                <tr>
                  <th scope="col">Objek</th>
                  {urut.map((p, i) => (
                    <th scope="col" key={p.id} title={`${p.name} · ${p.weight}%`}>
                      {bisaDiisi.length > 0 ? (
                        <button type="button" className="lembar-tabel__nomor" onClick={() => pindah(i)}>
                          {i + 1}
                        </button>
                      ) : (
                        <span className="lembar-tabel__nomor">{i + 1}</span>
                      )}
                      <small>{p.weight}%</small>
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
                      <th scope="row">
                        <span className="lembar-tabel__nama">{b.objectName}</span>
                        {b.unitName && <small className="lembar-tabel__unit">{b.unitName}</small>}
                        {!b.bolehDiisi && (
                          <small className="lembar-tabel__status" data-status={b.displayStatus}>
                            {statusLabel[b.displayStatus] ?? b.displayStatus}
                          </small>
                        )}
                        {galat && (
                          <small role="alert" className="lembar-tabel__galat">
                            {galat}
                          </small>
                        )}
                      </th>
                      {urut.map((p) => {
                        const v = nilai[b.assignmentId]?.[p.id] ?? "";
                        return (
                          <td key={p.id} className="lembar-tabel__angka">
                            {v === "" ? "—" : displayNumber(Number(v))}
                          </td>
                        );
                      })}
                      <td className="lembar-tabel__nilai">{total(b)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {bisaDiisi.length > 0 && (
            <div className="lembar-navigasi">
              <button
                type="button"
                className="assessment-actions__draft tap-target"
                disabled={kirimPending}
                onClick={() => pindah(urut.length - 1)}
              >
                ← Kembali
              </button>
              <ThemeButton
                type="button"
                className="assessment-actions__submit"
                disabled={kirimPending}
                onClick={kirimSemua}
              >
                {kirimPending ? "Mengirim…" : `Kirim jawaban (${bisaDiisi.length})`}
              </ThemeButton>
              {kirimState.error && (
                <p role="alert" className="lembar-navigasi__keterangan lembar-navigasi__keterangan--galat">
                  {kirimState.error}
                </p>
              )}
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
