"use client";

import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";

import type { getCategoryDetail } from "@/lib/services/categories";

type AssignmentRule = NonNullable<Awaited<ReturnType<typeof getCategoryDetail>>>["assignmentRules"][number];
type UserType = { id: string; name: string };

const fieldClass =
  "form__control disabled:opacity-60";

/** Isian syarat calon satu kelompok; disimpan bersama bagian lain oleh AturanPenilaiForm. */
export function AssignmentRuleFields({
  rule,
  userTypes,
  editable,
}: {
  rule: AssignmentRule;
  userTypes: UserType[];
  editable: boolean;
}) {
  const currentTypeIds = new Set((rule.userTypeIds as string[] | null) ?? []);
  const f = (nama: string) => `ar__${rule.id}__${nama}`;

  return (
    <div className="grid gap-3">
      <input type="hidden" name="assignmentRuleIds" value={rule.id} />

      <label className="admin-tools__field">
        <span>Lingkup calon<Info>{KET.lingkup}</Info></span>
        <select name={f("scope")} defaultValue={rule.scope} disabled={!editable} className={fieldClass}>
          <option value="UNIT_OBJEK">Unit objek saja</option>
          <option value="UNIT_DAN_SUBUNIT">Unit objek dan subunitnya</option>
          {/* Hanya untuk Pimpinan: satu prodi biasanya cuma punya satu atau dua pejabat, jadi
              target penilai baru terpenuhi bila pimpinan departemen dan fakultas ikut jadi calon.
              Pada kelompok Selain Pimpinan, naik ke atas justru menarik seluruh isi fakultas. */}
          {rule.group === "PIMPINAN" && (
            <option value="UNIT_DAN_INDUK">Unit objek dan unit di atasnya</option>
          )}
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
                name={f("userTypeIds")}
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

      {!editable && (
        <p className="aturan-terkunci">Terkunci — hanya bisa diubah saat periode berstatus Draf.</p>
      )}
    </div>
  );
}
