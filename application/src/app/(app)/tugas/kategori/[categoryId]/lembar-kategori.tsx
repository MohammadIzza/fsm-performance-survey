"use client";

import { useEffect, useRef, useState } from "react";
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
 * Lembar penilaian satu kategori: instrumennya dibaca sekali di atas, lalu seluruh objek masuk ke
 * satu tabel — baris objek, kolom parameter. Sebelumnya tiap objek berdiri sebagai halaman sendiri, sehingga penilai yang
 * kebagian enam objek dalam satu kategori membaca instrumen yang sama enam kali.
 *
 * Yang dikirim ke server tetap per tugas: satu baris yang gagal (mis. bentrok versi karena diubah
 * dari tab lain) tidak ikut membatalkan baris lain, dan objek yang sudah terkirim tidak pernah
 * ikut terkirim ulang — barisnya memang tidak lagi menyertakan medan tersembunyi apa pun.
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


const drafAwal: KategoriFormState = {};
const kirimAwal: KategoriFormState = {};

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
  const [drafState, drafAction, drafPending] = useAksi(
    saveCategoryDraftAction,
    drafAwal,
    (h) => (h.ringkasan ? `Draf tersimpan untuk ${h.ringkasan.draf} objek.` : "Draf tersimpan.")
  );
  const [kirimState, kirimAction, kirimPending] = useAksi(submitCategoryAction, kirimAwal, null);
  const [konfirmasi, dialogKonfirmasi] = useKonfirmasi();
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

  const kotor = useRef(false);
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (kotor.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const bisaDiisi = baris.filter((b) => b.bolehDiisi);
  const lengkapnya = (b: BarisObjek) => urut.every((p) => (nilai[b.assignmentId]?.[p.id] ?? "") !== "");
  const jumlahLengkap = bisaDiisi.filter(lengkapnya).length;
  const versiTerbaru = (b: BarisObjek) => drafState.versions?.[b.assignmentId] ?? kirimState.versions?.[b.assignmentId] ?? b.version;

  const ringkasan = kirimState.ringkasan;
  const dialogBuka = !!kirimState.submittedAt && dialogDitutup !== kirimState.submittedAt;
  const galatBaris = new Map((ringkasan?.gagal ?? []).map((g) => [g.assignmentId, g.pesan]));

  function total(b: BarisObjek) {
    const isi = nilai[b.assignmentId] ?? {};
    const adaIsi = urut.some((p) => (isi[p.id] ?? "") !== "");
    if (!adaIsi) return "—";
    return displayNumber(
      urut.reduce((s, p) => {
        const n = Number(isi[p.id]);
        return s + (Number.isFinite(n) ? (n * p.weight) / 100 : 0);
      }, 0)
    );
  }

  return (
    <form
      action={drafAction}
      onChange={() => {
        kotor.current = true;
      }}
      onSubmit={() => {
        kotor.current = false;
      }}
      className="lembar-kategori"
    >
      <section className="assessment-sheet" aria-labelledby="lembar-judul">
        <header className="assessment-sheet__intro">
          <div>
            <p className="eyebrow">INSTRUMEN PENILAIAN</p>
            <h2 id="lembar-judul">Parameter yang dinilai</h2>
            {guide && <p>{guide}</p>}
          </div>
        </header>

        {/* Instrumen ditulis sekali di sini; di bawah, tiap objek cukup memakai nomornya. */}
        <ol className="lembar-instrumen">
          {urut.map((p, i) => (
            <li key={p.id}>
              <span className="lembar-instrumen__nomor">{i + 1}</span>
              <span className="lembar-instrumen__nama">
                <strong>{p.name}</strong>
                {p.indicator && <small>{p.indicator}</small>}
              </span>
              <span className="lembar-instrumen__bobot">{p.weight}%</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="assessment-sheet lembar-objek-daftar" aria-labelledby="lembar-objek-judul">
        <header className="assessment-sheet__intro">
          <div>
            <p className="eyebrow">OBJEK YANG ANDA NILAI</p>
            <h2 id="lembar-objek-judul">
              {baris.length} objek · skor {displayNumber(scale.min)}–{displayNumber(scale.max)}
            </h2>
          </div>
        </header>

        {/* Satu tabel: baris = objek, kolom = parameter. Nama parameter tidak ikut ke kepala
            kolom — di layar ponsel enam nama tidak akan muat dan pasti terpenggal; yang dipakai
            nomornya, dan daftar bernomor di atas yang menjelaskan nomor itu apa. */}
        <div className="app-table-wrap">
          <table className="lembar-tabel">
            <thead>
              <tr>
                <th scope="col">Objek</th>
                {urut.map((p, i) => (
                  <th scope="col" key={p.id} title={`${p.name} · ${p.weight}%`}>
                    <span className="lembar-tabel__nomor">{i + 1}</span>
                    <small>{p.weight}%</small>
                  </th>
                ))}
                <th scope="col">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => {
                const isi = nilai[b.assignmentId] ?? {};
                const galat = galatBaris.get(b.assignmentId);
                return (
                  <tr key={b.assignmentId} data-terkunci={b.bolehDiisi ? undefined : "true"}>
                    <th scope="row">
                      {b.bolehDiisi && (
                        <>
                          <input type="hidden" name="tugas" value={b.assignmentId} />
                          <input type="hidden" name={`nama.${b.assignmentId}`} value={b.objectName} />
                          <input type="hidden" name={`kunci.${b.assignmentId}`} value={kunci[b.assignmentId]} />
                          <input type="hidden" name={`versi.${b.assignmentId}`} value={versiTerbaru(b) ?? ""} />
                          {urut.map((p) => (
                            <input
                              key={p.id}
                              type="hidden"
                              name={`skor.${b.assignmentId}.${p.id}`}
                              value={isi[p.id] ?? ""}
                            />
                          ))}
                        </>
                      )}
                      <span className="lembar-tabel__nama">{b.objectName}</span>
                      {b.unitName && <small className="lembar-tabel__unit">{b.unitName}</small>}
                      <small className="lembar-tabel__status" data-status={b.displayStatus}>
                        {statusLabel[b.displayStatus] ?? b.displayStatus}
                      </small>
                      {galat && (
                        <small role="alert" className="lembar-tabel__galat">
                          {galat}
                        </small>
                      )}
                    </th>
                    {urut.map((p, i) => (
                      <td key={p.id} className="lembar-tabel__skor">
                        {b.bolehDiisi ? (
                          <ScoreField
                            id={`skor-${b.assignmentId}-${p.id}`}
                            label={`Parameter ${i + 1} (${p.name}) untuk ${b.objectName}`}
                            scale={scale}
                            value={isi[p.id] ?? ""}
                            onChange={(v) =>
                              setNilai((s) => ({
                                ...s,
                                [b.assignmentId]: { ...s[b.assignmentId], [p.id]: v },
                              }))
                            }
                            disabled={false}
                          />
                        ) : (
                          <span className="lembar-tabel__angka">
                            {isi[p.id] === "" || isi[p.id] === undefined
                              ? "—"
                              : displayNumber(Number(isi[p.id]))}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="lembar-tabel__nilai">{total(b)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {bisaDiisi.length > 0 && (
        <div className="assessment-actions">
          <button
            type="submit"
            disabled={drafPending || kirimPending}
            className="assessment-actions__draft tap-target"
          >
            {drafPending ? "Menyimpan…" : "Simpan draf"}
          </button>
          <ThemeButton
            type="submit"
            formAction={kirimAction}
            disabled={drafPending || kirimPending}
            className="assessment-actions__submit"
            onClick={async (e) => {
              e.preventDefault();
              const tombol = e.currentTarget;
              if (jumlahLengkap === 0) {
                await konfirmasi({
                  label: "Belum bisa dikirim",
                  judul: "Belum ada objek yang lengkap",
                  pesan: (
                    <p>
                      Setiap objek harus memiliki skor untuk seluruh {urut.length} parameter sebelum
                      bisa dikirim. Lengkapi dulu salah satunya, atau simpan sebagai draf.
                    </p>
                  ),
                  tombolBatal: "Kembali mengisi",
                });
                return;
              }
              const sisa = bisaDiisi.length - jumlahLengkap;
              const ya = await konfirmasi({
                label: "Kirim penilaian",
                judul: `Kirim ${jumlahLengkap} objek sekarang?`,
                pesan: (
                  <p>
                    {jumlahLengkap} objek sudah terisi lengkap dan akan dikirim — setelah terkirim,
                    jawabannya terkunci dan hanya bisa diubah lewat admin.
                    {sisa > 0 && ` ${sisa} objek lain belum lengkap dan hanya disimpan sebagai draf.`}
                  </p>
                ),
                tombolYa: "Kirim sekarang",
                tombolBatal: "Periksa lagi",
              });
              if (ya) tombol.form?.requestSubmit(tombol);
            }}
          >
            {kirimPending ? "Mengirim…" : `Kirim jawaban${jumlahLengkap > 0 ? ` (${jumlahLengkap})` : ""}`}
          </ThemeButton>
          {drafState.savedAt && (
            <span className="order-3 text-center app-text-xs text-[var(--success)] sm:text-left">
              Tersimpan {new Date(drafState.savedAt).toLocaleTimeString("id-ID")}
            </span>
          )}
          {(drafState.error || kirimState.error) && (
            <div className="w-full">
              <p role="alert" className="text-sm text-[var(--danger)]">
                {drafState.error || kirimState.error}
              </p>
              {(drafState.error ?? kirimState.error ?? "").includes("berubah sejak") && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-1 app-text-sm font-medium text-[var(--accent)] hover:underline"
                >
                  Muat ulang halaman
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {dialogKonfirmasi}
      <DialogLembar
        buka={dialogBuka}
        terkirim={ringkasan?.terkirim ?? 0}
        draf={ringkasan?.draf ?? 0}
        gagal={ringkasan?.gagal.length ?? 0}
        onTutup={() => setDialogDitutup(kirimState.submittedAt ?? null)}
      />
    </form>
  );
}
