"use client";

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
        <span>Lingkup calon</span>
        <select name="scope" defaultValue={rule.scope} disabled={!editable} className={fieldClass}>
          <option value="UNIT_OBJEK">Unit objek saja</option>
          <option value="UNIT_DAN_SUBUNIT">Unit objek dan subunitnya</option>
        </select>
      </label>

      <label className="admin-tools__field">
        <span>
          Filter jenis pengguna (kosongkan untuk semua jenis)
        </span>
        <div className="flex flex-wrap gap-3">
          {userTypes.map((t) => (
            <label key={t.id} className="flex items-center gap-1.5 app-text-sm text-[var(--foreground)]">
              <input
                type="checkbox"
                name="userTypeIds"
                value={t.id}
                defaultChecked={currentTypeIds.has(t.id)}
                disabled={!editable}
                className="h-4 w-4"
              />
              {t.name}
            </label>
          ))}
        </div>
      </label>

      {editable ? (
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 app-text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {pending ? "Menyimpan…" : "Simpan aturan"}
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
