"use client";

import { useActionState } from "react";
import { updateGroupRuleAction } from "@/lib/actions/admin-instruments";
import type { getCategoryDetail } from "@/lib/services/categories";

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
  const [state, formAction, pending] = useActionState(updateGroupRuleAction, {});

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="groupRuleId" value={rule.id} /><input type="hidden" name="expectedRevision" value={rule.revision} />
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="categoryId" value={categoryId} />

      <div>
        <label className="mb-1 block app-text-xs text-[var(--muted)]">Metode agregasi</label>
        <select
          name="aggregation"
          defaultValue={rule.aggregation}
          disabled={!editable}
          className={fieldClass}
        >
          <option value="RATA_RATA">Rata-rata</option>
          <option value="TOTAL">Total</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block app-text-xs text-[var(--muted)]">Target penilai</label>
          <input
            name="target"
            type="number"
            min={0}
            defaultValue={rule.target}
            disabled={!editable}
            required
            className={fieldClass}
          />
        </div>
        <div>
          <label className="mb-1 block app-text-xs text-[var(--muted)]">Minimum respons</label>
          <input
            name="minimum"
            type="number"
            min={1}
            defaultValue={rule.minimum}
            disabled={!editable}
            required
            className={fieldClass}
          />
        </div>
      </div>
      <label className="text-sm">Parameter pembeda nilai sama (opsional)
        <select name="tieBreakParameterIds" multiple disabled={!editable} defaultValue={(rule.tieBreakParameterIds as string[]|null)??[]} className={fieldClass+" block w-full"}>
         {parameters.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select><span className="block text-xs text-[var(--muted)]">Urutan sesuai urutan parameter. Tanpa pilihan, peringkat bersama 1, 2, 2, 4.</span>
      </label>
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
            <p role="alert" className="text-sm text-[var(--danger)]">
              {state.error}
            </p>
          )}
        </div>
      ) : (
        <p className="app-text-sm text-[var(--muted)]">Terkunci di luar status Draf.</p>
      )}
    </form>
  );
}
