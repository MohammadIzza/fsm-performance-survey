"use client";

import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";

import { useAksi } from "@/components/theme/notifikasi";
import { useRef, useState } from "react";
import { createCategoryAction } from "@/lib/actions/admin-categories";
import { PilihanCari } from "@/components/theme/pilihan-cari";

export interface SumberKategori {
  id: string;
  label: string;
  name: string;
  description: string | null;
  objectTypeName: string;
  parameterCount: number;
  objectCount: number;
  scale: { min: number; max: number; step: number };
  parameters: { name: string; weight: number; normalized: boolean }[];
  groupRules: { group: "PIMPINAN" | "SELAIN_PIMPINAN"; aggregation: string; target: number; minimum: number }[];
  /** Bobot kelompok Pimpinan pada nilai gabungan; null bila kategori tidak menggabungkan. */
  pimpinanWeight: number | null;
}

const namaKelompok: Record<string, string> = {
  PIMPINAN: "Pimpinan",
  SELAIN_PIMPINAN: "Selain Pimpinan",
};
const namaAgregasi: Record<string, string> = { RATA_RATA: "Rata-rata", TOTAL: "Total" };

/**
 * Isi kategori sumber, ditampilkan sebelum tombol salin ditekan. Menyalin membawa pertanyaan,
 * bobot, skala, dan aturan penilai sekaligus — tanpa pratinjau, admin baru tahu apa yang ia bawa
 * setelah kategorinya terbentuk, dan satu-satunya cara membatalkan adalah menghapusnya lagi.
 */
function PratinjauSumber({ sumber }: { sumber: SumberKategori }) {
  const totalBobot = sumber.parameters.reduce((jumlah, p) => jumlah + p.weight, 0);
  return (
    <div className="kategori-pratinjau sm:col-span-4">
      <p className="kategori-pratinjau__judul">Yang akan tersalin dari {sumber.label}</p>
      <ul className="kategori-pratinjau__parameter">
        {sumber.parameters.map((p) => (
          <li key={p.name}>
            <span>
              {p.name}
              {p.normalized && <span className="kategori-pratinjau__tanda"> nilai mentah</span>}
            </span>
            <span className="kategori-pratinjau__bobot">{p.weight}%</span>
          </li>
        ))}
      </ul>
      <p className="kategori-pratinjau__kaki">
        Total bobot {Math.round(totalBobot * 100) / 100}% · skala {sumber.scale.min} sampai {sumber.scale.max},
        kelipatan {sumber.scale.step}
      </p>
      {sumber.groupRules.length > 0 && (
        <p className="kategori-pratinjau__kaki">
          {sumber.groupRules
            .map(
              (r) =>
                `${namaKelompok[r.group] ?? r.group}: ${namaAgregasi[r.aggregation] ?? r.aggregation}, target ${r.target}, minimum ${r.minimum}`
            )
            .join(" · ")}
          {sumber.pimpinanWeight != null &&
            ` · nilai gabungan ${sumber.pimpinanWeight}% : ${100 - sumber.pimpinanWeight}%`}
        </p>
      )}
      <p className="kategori-pratinjau__kaki">
        Tidak ikut tersalin: pembagian tugas, jawaban penilai, dan hasil perhitungan.
      </p>
    </div>
  );
}

const fieldClass =
  "form__control";

export function CategoryCreateForm({
  periodId,
  objectTypes,
  sources,
}: {
  periodId: string;
  objectTypes: { id: string; code: string; name: string }[];
  /** Kategori mana pun yang instrumennya sudah berisi parameter, dari periode mana pun. */
  sources: SumberKategori[];
}) {
  // Kategori salinan datang sudah lengkap: pertanyaan, bobot, aturan penilai, dan (bila dicentang)
  // pesertanya. Panduan langkah karena itu langsung melompat ke Bagikan tugas — satu-satunya
  // langkah yang memang belum terisi. Notifikasinya menyebutkan itu supaya lompatannya tidak
  // terbaca seperti langkah yang terlewat.
  const [state, formAction, pending] = useAksi(createCategoryAction, {}, (_hasil, fd) =>
    fd.get("sourceCategoryId")
      ? `Kategori disalin. Pertanyaan, bobot, dan aturan penilai${
          fd.get("includeObjects") === "on" ? " beserta pesertanya" : ""
        } ikut tersalin, jadi panduan lanjut ke langkah berikutnya yang belum selesai.`
      : "Kategori ditambahkan."
  );
  const [typeId, setTypeId] = useState("");
  const [sumberId, setSumberId] = useState("");
  const [nama, setNama] = useState("");
  const [tujuan, setTujuan] = useState("");
  /**
   * Isian yang terakhir diisikan otomatis dari kategori sumber. Dipakai membedakan isian yang
   * masih apa adanya dari isian yang sudah diketik ulang admin: mengganti sumber menimpa yang
   * pertama, tetapi tidak pernah menghapus yang kedua.
   */
  const otomatis = useRef({ nama: "", tujuan: "" });

  // Menyalin berarti memakai kategori yang sudah ada sebagai titik berangkat, jadi nama dan
  // tujuannya ikut terisi — bukan dikosongkan lalu diketik ulang persis sama. Keduanya tetap
  // isian biasa yang boleh diubah, termasuk saat namanya harus dibedakan dari sumbernya.
  function pilihSumber(id: string) {
    setSumberId(id);
    const dipilih = sources.find((s) => s.id === id);
    const namaBaru = dipilih?.name ?? "";
    const tujuanBaru = dipilih?.description ?? "";
    // Nilai pembanding diambil SEBELUM ref ditimpa: React menjalankan fungsi pembaru state ini
    // belakangan, saat render berikutnya — membaca otomatis.current di dalamnya berarti membaca
    // nilai yang baru saja ditulis di baris terakhir, sehingga perbandingannya tidak pernah cocok
    // dan isiannya tidak pernah terisi.
    const namaSebelum = otomatis.current.nama;
    const tujuanSebelum = otomatis.current.tujuan;
    // Isian yang masih kosong ikut diisi: mengosongkannya sendiri lalu memilih sumber lain berarti
    // orangnya sedang mencari isi, bukan sedang menolaknya.
    const bolehDiisi = (sekarang: string, sebelum: string) => sekarang.trim() === "" || sekarang === sebelum;
    setNama((sekarang) => (bolehDiisi(sekarang, namaSebelum) ? namaBaru : sekarang));
    setTujuan((sekarang) => (bolehDiisi(sekarang, tujuanSebelum) ? tujuanBaru : sekarang));
    otomatis.current = { nama: namaBaru, tujuan: tujuanBaru };
  }
  // Pembuat karya hanya ada pada objek jenis Karya, jadi pilihannya hanya ditampilkan di sana.
  const isKarya = objectTypes.find((t) => t.id === typeId)?.code === "KARYA";
  const sumber = sources.find((s) => s.id === sumberId);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="periodId" value={periodId} />

      {/* Menyalin kategori lain: pertanyaan, bobot, aturan kelompok, syarat calon, dan bobot nilai
          gabungan ikut terbawa. Jenis objeknya mengikuti sumbernya, jadi pilihannya disembunyikan
          supaya tidak ada dua sumber kebenaran untuk hal yang sama. */}
      {sources.length > 0 && (
        <label className="admin-tools__field sm:col-span-4">
          <span>
            Salin dari kategori yang sudah ada (opsional)
            <Info>{KET.salinKategori}</Info>
          </span>
          <PilihanCari
            name="sourceCategoryId"
            aria-label="Kategori sumber"
            value={sumberId}
            onChange={pilihSumber}
            kosong={{ label: "Mulai dari kosong", bisaDipilih: true }}
            options={sources.map((s) => ({
              value: s.id,
              label: `${s.label} · ${s.objectTypeName}, ${s.parameterCount} pertanyaan`,
            }))}
          />
        </label>
      )}

      {sumber && <PratinjauSumber sumber={sumber} />}

      <label className="admin-tools__field sm:col-span-3">
        <span>Nama kategori</span>
        <input
          name="name"
          placeholder="mis. Dosen Favorit se-FSM"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          required
          className={fieldClass}
        />
      </label>

      {sumber ? (
        <div className="admin-tools__field">
          <span>Yang akan dinilai<Info>{KET.jenisObjek}</Info></span>
          <p className="kategori-sumber__jenis">{sumber.objectTypeName}, ikut sumber</p>
        </div>
      ) : (
        <label className="admin-tools__field">
          <span>Yang akan dinilai<Info>{KET.jenisObjek}</Info></span>
          <select
            name="objectTypeId"
            required
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className={fieldClass}
          >
            <option value="" disabled>
              Pilih jenis objek…
            </option>
            {objectTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="admin-tools__field sm:col-span-3">
        <span>Tujuan penilaian</span>
        <textarea
          name="description"
          placeholder="Deskripsi (opsional)"
          rows={2}
          value={tujuan}
          onChange={(e) => setTujuan(e.target.value)}
          className={fieldClass}
        />
      </label>

      {sumber ? (
        <label className="flex items-center gap-2 app-text-sm text-[var(--foreground)] sm:col-span-4">
          <input
            type="checkbox"
            name="includeObjects"
            defaultChecked={sumber.objectCount > 0}
            disabled={sumber.objectCount === 0}
            className="h-4 w-4"
          />
          {sumber.objectCount > 0
            ? `Ikut salin ${sumber.objectCount} objek peserta dari kategori sumber`
            : "Kategori sumber belum punya objek peserta"}
        </label>
      ) : isKarya ? (
        <label className="flex items-center gap-2 app-text-sm text-[var(--foreground)]">
          <input type="checkbox" name="excludeContributors" defaultChecked className="h-4 w-4" />
          Kecualikan pembuat karya sebagai penilai
          <Info>{KET.kecualikanPembuat}</Info>
        </label>
      ) : (
        // Jenis lain tetap menyimpan bawaan yang aman (dikecualikan), tanpa menampilkan pilihannya.
        <input type="hidden" name="excludeContributors" value="on" />
      )}

      <div className="flex items-center gap-2 sm:col-span-4">
        <button
          type="submit"
          disabled={pending}
          className="app-btn app-btn--primary"
        >
          {pending ? "Menyimpan…" : sumber ? "Salin jadi kategori baru" : "Tambah kategori"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
