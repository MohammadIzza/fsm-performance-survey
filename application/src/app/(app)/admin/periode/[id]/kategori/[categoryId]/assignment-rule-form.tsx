"use client";

import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";

import { useAksi } from "@/components/theme/notifikasi";
import { updateAssignmentRuleAction } from "@/lib/actions/admin-assignments";
import type { getCategoryDetail } from "@/lib/services/categories";

type AssignmentRule = NonNullable<Awaited<ReturnType<typeof getCategoryDetail>>>["assignmentRules"][number];
type UserType = { id: string; name: string };

const fieldClass =
  "form__control disabled:opacity-60";

export function AssignmentRuleForm({
  rule,
  userTypes,
  periodId,
  categoryId,
  editable,
}: {
  rule: AssignmentRule;
  userTypes: UserType[];
  periodId: string;
  categoryId: string;
  editable: boolean;
}) {
  const [state, formAction, pending] = useAksi(updateAssignmentRuleAction, {}, "Aturan pembagian tugas disimpan.");
  const currentTypeIds = new Set((rule.userTypeIds as string[] | null) ?? []);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="ruleId" value={rule.id} />
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="categoryId" value={categoryId} />

      <label className="admin-tools__field">
        <span>Lingkup calon<Info>{KET.lingkup}</Info></span>
        <select name="scope" defaultValue={rule.scope} disabled={!editable} className={fieldClass}>
          <option value="UNIT_OBJEK">Unit objek saja</option>
          <option value="UNIT_DAN_SUBUNIT">Unit objek dan subunitnya</option>
        </select>
      </label>

      <div className="admin-tools__field">
        <span>
          Jenis pengguna yang boleh menilai
          <Info>{KET.filterJenis}</Info>
        </span>
        <div className="aturan-centang">
          {userTypes.map((t) => (
            <label key={t.id}>
              <input
                type="checkbox"
                name="userTypeIds"
                value={t.id}
                defaultChecked={currentTypeIds.has(t.id)}
                disabled={!editable}
              />
              {t.name}
            </label>
          ))}
        </div>
        <span className="admin-tools__hint">Kosongkan untuk semua jenis.</span>
      </div>

      {editable ? (
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="app-btn app-btn--primary"
          >
            {pending ? "Menyimpan…" : "Simpan aturan"}
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
