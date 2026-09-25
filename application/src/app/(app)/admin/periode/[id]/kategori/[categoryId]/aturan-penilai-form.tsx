"use client";

import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";
import { useAksi } from "@/components/theme/notifikasi";
import { simpanAturanPenilaiAction } from "@/lib/actions/admin-instruments";
import { GroupRuleFields } from "./group-rule-form";
import { AssignmentRuleFields } from "./assignment-rule-form";
import { CombinedWeightFields } from "./combined-weight-form";
import { PredikatFields } from "./predikat-form";
import type { getCategoryDetail } from "@/lib/services/categories";
import type { AmbangPredikat } from "@/lib/predikat";

type Kategori = NonNullable<Awaited<ReturnType<typeof getCategoryDetail>>>;

/**
 * Seluruh aturan penilai satu kategori dalam satu formulir dan satu tombol simpan.
 *
 * Sebelumnya bagian ini berisi enam formulir terpisah — dua kelompok penilai, nilai gabungan,
 * predikat, dan dua syarat calon — masing-masing dengan tombol Simpan sendiri. Orang yang mengubah
 * target penilai lalu menggulir ke bawah dan menekan Simpan di bagian lain kehilangan perubahannya
 * tanpa pemberitahuan apa pun, karena tombol itu hanya menyimpan bagiannya sendiri.
 *
 * Yang tersimpan hanya bagian yang memang boleh diubah pada status periode saat ini; batasnya
 * ditentukan ulang di server, bukan dipercayakan pada isian yang dikirim peramban.
 */
export function AturanPenilaiForm({
  periodId,
  categoryId,
  groupRules,
  assignmentRules,
  parameters,
  userTypes,
  pimpinanWeight,
  bands,
  skorMaksimum,
  editableAturan,
  editableGabungan,
  editablePredikat,
  tampilkanGabunganDanPredikat = true,
}: {
  periodId: string;
  categoryId: string;
  groupRules: Kategori["groupRules"];
  assignmentRules: Kategori["assignmentRules"];
  parameters: { id: string; name: string }[];
  userTypes: { id: string; name: string }[];
  pimpinanWeight: number | null;
  bands: AmbangPredikat[] | null;
  skorMaksimum: number | null;
  /** Jumlah penilai dan syarat calon: hanya saat Draf. */
  editableAturan: boolean;
  /** Bobot nilai gabungan: sampai periode berjalan. */
  editableGabungan: boolean;
  /** Ambang predikat: sampai sebelum final. */
  editablePredikat: boolean;
  /** Langkah periode hanya memuat aturan kelompok dan syarat calon. */
  tampilkanGabunganDanPredikat?: boolean;
}) {
  const [state, formAction, pending] = useAksi(
    simpanAturanPenilaiAction,
    {},
    "Aturan penilai disimpan."
  );
  const urut = (a: { group: string }) => (a.group === "PIMPINAN" ? -1 : 1);
  const judul = (group: string) => (group === "PIMPINAN" ? "Pimpinan" : "Selain Pimpinan");
  const bisaSimpan =
    editableAturan || (tampilkanGabunganDanPredikat && (editableGabungan || editablePredikat));

  return (
    <form action={formAction} className="aturan-penilai">
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="categoryId" value={categoryId} />

      <div>
        <p className="eyebrow aturan-penilai__judul">Jumlah penilai dan perhitungan</p>
        <div className="aturan-penilai__pasangan">
          {groupRules
            .slice()
            .sort(urut)
            .map((rule) => (
              <div key={rule.id} className="app-panel app-panel--ruled">
                <h2 className="app-panel__label">
                  {judul(rule.group)}
                  <Info>{KET.kelompok}</Info>
                </h2>
                <GroupRuleFields rule={rule} editable={editableAturan} parameters={parameters} />
              </div>
            ))}
        </div>
      </div>

      {tampilkanGabunganDanPredikat && (
        <>
          <div>
            <p className="eyebrow aturan-penilai__judul">Nilai gabungan</p>
            <div className="app-panel app-panel--ruled">
              <CombinedWeightFields pimpinanWeight={pimpinanWeight} editable={editableGabungan} />
            </div>
          </div>

          <div>
            <p className="eyebrow aturan-penilai__judul">Predikat nilai</p>
            <div className="app-panel app-panel--ruled">
              <PredikatFields bands={bands} skorMaksimum={skorMaksimum} editable={editablePredikat} />
            </div>
          </div>
        </>
      )}

      <div>
        <p className="eyebrow aturan-penilai__judul">Syarat penilai</p>
        <div className="aturan-penilai__pasangan">
          {assignmentRules
            .slice()
            .sort(urut)
            .map((rule) => (
              <div key={rule.id} className="app-panel app-panel--ruled">
                <h2 className="app-panel__label">
                  {judul(rule.group)}
                  <Info>{KET.kelompok}</Info>
                </h2>
                <AssignmentRuleFields rule={rule} userTypes={userTypes} editable={editableAturan} />
              </div>
            ))}
        </div>
      </div>

      {bisaSimpan && (
        <div className="aturan-penilai__simpan">
          <button type="submit" disabled={pending} className="app-btn app-btn--primary">
            {pending ? "Menyimpan…" : "Simpan aturan penilai"}
          </button>
          <span className="aturan-penilai__catatan">Menyimpan seluruh bagian di atas sekaligus.</span>
          {state.error && (
            <p role="alert" className="aturan-galat">
              {state.error}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
