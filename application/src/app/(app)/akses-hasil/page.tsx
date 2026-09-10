import { getCurrentAuthContext } from "@/lib/authz";
import { listPeriods } from "@/lib/services/periods";
import { PageHero } from "@/components/page-hero";
import { DataList } from "@/components/theme/data-list";
import { AccessPolicyRow } from "./access-policy-row";

export default async function AccessPage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx || (!ctx.isAdmin && !ctx.isDekan)) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
        <p className="text-[15px] font-medium text-[var(--foreground)]">Tidak berwenang</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Halaman ini hanya untuk Admin dan Dekan.
        </p>
      </div>
    );
  }

  const periods = await listPeriods();

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow={`WAKTU AKSES · ${periods.length} periode`}
        title={
          <>
            Kapan hasil
            <br />
            boleh dibaca.
          </>
        }
        description="Atur waktu pimpinan, termasuk Dekan, dapat membaca hasil. Setiap perubahan tercatat."
      />

      {periods.length === 0 ? (
        <p className="t-t-md" style={{ color: "var(--color-text)" }}>
          Belum ada periode survei.
        </p>
      ) : (
        <DataList
          columns={[
            ["title", "Periode"],
            ["duration", "Kebijakan"],
            ["location", "Waktu tertentu"],
            ["dates", "Status"],
            ["price", "Aksi"],
          ]}
        >
          {periods.map((p) => (
            <AccessPolicyRow
              key={p.id}
              period={{
                id: p.id,
                name: p.name,
                code: p.code,
                status: p.status,
                createdByName: p.createdBy.name,
                accessPolicy: p.accessPolicy
                  ? { ...p.accessPolicy, changedBy: { name: p.createdBy.name } }
                  : null,
              }}
            />
          ))}
        </DataList>
      )}
    </div>
  );
}
