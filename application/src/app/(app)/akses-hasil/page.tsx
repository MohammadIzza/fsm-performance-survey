import { getCurrentAuthContext } from "@/lib/authz";
import { listPeriods } from "@/lib/services/periods";
import { PageHero } from "@/components/page-hero";
import { AccessPolicyForm } from "../admin/periode/[id]/access-policy-form";

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
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <p className="text-[15px] text-[var(--muted)]">Belum ada periode survei.</p>
        </div>
      ) : (
        periods.map((p) => (
          <section
            key={p.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
          >
            <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
              {p.name}
            </h2>
            {p.accessPolicy && (
              <AccessPolicyForm
                periodId={p.id}
                accessPolicy={{ ...p.accessPolicy, changedBy: { name: p.createdBy.name } }}
              />
            )}
          </section>
        ))
      )}
    </div>
  );
}
