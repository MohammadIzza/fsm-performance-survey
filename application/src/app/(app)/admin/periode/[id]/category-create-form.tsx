"use client";

import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";

import { useAksi } from "@/components/theme/notifikasi";
import { useState } from "react";
import { createCategoryAction } from "@/lib/actions/admin-categories";
import { PilihanCari } from "@/components/theme/pilihan-cari";

export interface SumberKategori {
  id: string;
  label: string;
  objectTypeName: string;
  parameterCount: number;
  objectCount: number;
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
  const [state, formAction, pending] = useAksi(createCategoryAction, {}, "Kategori ditambahkan.");
  const [typeId, setTypeId] = useState("");
  const [sumberId, setSumberId] = useState("");
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
            onChange={setSumberId}
            kosong={{ label: "Mulai dari kosong", bisaDipilih: true }}
            options={sources.map((s) => ({
              value: s.id,
              label: `${s.label} — ${s.objectTypeName}, ${s.parameterCount} pertanyaan`,
            }))}
          />
        </label>
      )}

      <label className="admin-tools__field sm:col-span-3">
        <span>Nama kategori</span>
        <input
          name="name"
          placeholder="mis. Dosen Favorit se-FSM"
          defaultValue=""
          required
          className={fieldClass}
        />
      </label>

      {sumber ? (
        <div className="admin-tools__field">
          <span>Yang akan dinilai<Info>{KET.jenisObjek}</Info></span>
          <p className="kategori-sumber__jenis">{sumber.objectTypeName} · ikut sumber</p>
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
