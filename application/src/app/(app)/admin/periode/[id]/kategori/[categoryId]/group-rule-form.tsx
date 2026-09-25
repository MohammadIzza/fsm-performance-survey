"use client";

import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";

import type { getCategoryDetail } from "@/lib/services/categories";
import { PilihanBerurutan } from "@/components/theme/pilihan-berurutan";

type GroupRule = NonNullable<Awaited<ReturnType<typeof getCategoryDetail>>>["groupRules"][number];

const fieldClass =
  "form__control disabled:opacity-60";

/**
 * Isian jumlah penilai dan perhitungan satu kelompok. Bukan formulir tersendiri: seluruh bagian
 * Aturan penilai disimpan sekaligus oleh satu tombol di AturanPenilaiForm, jadi nama isiannya
 * diberi awalan id aturan supaya dua kelompok tidak bertabrakan dalam satu FormData.
 */
export function GroupRuleFields({
  rule,
  editable,
  parameters,
}: {
  rule: GroupRule;
  editable: boolean;
  parameters: {id:string;name:string}[];
}) {
  const f = (nama: string) => `gr__${rule.id}__${nama}`;

  return (
    <div className="grid gap-3">
      <input type="hidden" name="groupRuleIds" value={rule.id} />
      <input type="hidden" name={f("revision")} value={rule.revision} />

      <label className="admin-tools__field">
        <span>Metode agregasi<Info>{KET.agregasi}</Info></span>
        <select
          name={f("aggregation")}
          defaultValue={rule.aggregation}
          disabled={!editable}
          className={fieldClass}
        >
          <option value="RATA_RATA">Rata-rata</option>
          <option value="TOTAL">Total</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="admin-tools__field">
          <span>Target penilai<Info>{KET.target}</Info></span>
          <input
            name={f("target")}
            type="number"
            min={0}
            defaultValue={rule.target}
            disabled={!editable}
            required
            className={fieldClass}
          />
        </label>
        <label className="admin-tools__field">
          <span>Minimum respons<Info>{KET.minimum}</Info></span>
          <input
            name={f("minimum")}
            type="number"
            min={1}
            defaultValue={rule.minimum}
            disabled={!editable}
            required
            className={fieldClass}
          />
        </label>
      </div>
      <div className="admin-tools__field">
        <span>
          Parameter pembeda nilai sama (opsional)
          <Info>{KET.pembeda}</Info>
        </span>
        <PilihanBerurutan
          name={f("tieBreakParameterIds")}
          aria-label="Parameter pembeda nilai sama"
          disabled={!editable}
          defaultValue={(rule.tieBreakParameterIds as string[] | null) ?? []}
          options={parameters.map((p) => ({ value: p.id, label: p.name }))}
        />
        <span className="admin-tools__hint">
          Klik untuk memilih, klik lagi untuk melepas. Nomor menunjukkan prioritas: yang dipilih lebih
          dulu diperiksa lebih dulu. Tanpa pilihan, nilai yang sama berbagi peringkat (1, 2, 2, 4).
        </span>
      </div>
      {!editable && (
        <p className="aturan-terkunci">Terkunci — hanya bisa diubah saat periode berstatus Draf.</p>
      )}
    </div>
  );
}
