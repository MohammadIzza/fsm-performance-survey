"use client";

import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";

import { useAksi } from "@/components/theme/notifikasi";
import { updateGroupRuleAction } from "@/lib/actions/admin-instruments";
import type { getCategoryDetail } from "@/lib/services/categories";
import { PilihanCariBanyak } from "@/components/theme/pilihan-cari";

type GroupRule = NonNullable<Awaited<ReturnType<typeof getCategoryDetail>>>["groupRules"][number];

const fieldClass =
  "form__control disabled:opacity-60";

export function GroupRuleForm({
  rule,
  periodId,
  categoryId,
  editable,
  parameters,
}: {
  rule: GroupRule;
  periodId: string;
  categoryId: string;
  editable: boolean;
  parameters: {id:string;name:string}[];
}) {
  const [state, formAction, pending] = useAksi(updateGroupRuleAction, {}, "Aturan penilai disimpan.");

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="groupRuleId" value={rule.id} /><input type="hidden" name="expectedRevision" value={rule.revision} />
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="categoryId" value={categoryId} />

      <label className="admin-tools__field">
        <span>Metode agregasi<Info>{KET.agregasi}</Info></span>
        <select
          name="aggregation"
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
            name="target"
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
            name="minimum"
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
        <PilihanCariBanyak
          name="tieBreakParameterIds"
          aria-label="Parameter pembeda nilai sama"
          disabled={!editable}
          defaultValue={(rule.tieBreakParameterIds as string[] | null) ?? []}
          className="block w-full"
          options={parameters.map((p) => ({ value: p.id, label: p.name }))}
        />
        <span className="admin-tools__hint">
          Dipakai sesuai urutan parameter. Tanpa pilihan, nilai yang sama berbagi peringkat (1, 2, 2, 4).
        </span>
      </div>
      {editable ? (
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="app-btn app-btn--primary"
          >
            {pending ? "Menyimpan…" : "Simpan"}
          </button>
          {state.error && (
            <p role="alert" className="aturan-galat">
              {state.error}
            </p>
          )}
        </div>
      ) : (
        <p className="aturan-terkunci">Terkunci — hanya bisa diubah saat periode berstatus Draf.</p>
      )}
    </form>
  );
}
