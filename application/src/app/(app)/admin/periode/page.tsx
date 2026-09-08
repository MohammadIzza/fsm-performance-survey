import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import Link from "next/link";
import { listPeriods } from "@/lib/services/periods";
import { PeriodCreateForm } from "./period-create-form";

const statusLabel: Record<string, string> = {
  DRAF: "Draf",
  SIAP: "Siap",
  AKTIF: "Aktif",
  DITUTUP: "Ditutup",
  FINAL: "Final",
  REVISI: "Revisi",
};

const statusClass: Record<string, string> = {
  DRAF: "bg-black/5 text-[var(--muted)]",
  SIAP: "bg-blue-500/10 text-blue-600",
  AKTIF: "bg-[var(--success)]/10 text-[var(--success)]",
  DITUTUP: "bg-amber-500/10 text-amber-600",
  FINAL: "bg-purple-500/10 text-purple-600",
  REVISI: "bg-[var(--danger)]/10 text-[var(--danger)]",
};

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });

async function PeriodePage() {
  const periods = await listPeriods();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title text-[24px] sm:text-[28px] text-[var(--foreground)]">
          Periode
        </h1>
        <p className="mt-1 text-[15px] text-[var(--muted)]">
          Kelola pelaksanaan survei dan siklus hidupnya (Bab 7).
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Buat periode baru
        </h2>
        <PeriodCreateForm />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <table className="w-full min-w-[720px] text-left text-[14px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[12px] uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Periode</th>
              <th className="px-4 py-3 font-medium">Rentang waktu</th>
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[var(--muted)]">
                  Belum ada periode.
                </td>
              </tr>
            )}
            {periods.map((p) => (
              <tr key={p.id} className="border-b border-[var(--border)] last:border-b-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/periode/${p.id}`}
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    {p.name}
                  </Link>
                  <div className="font-mono text-[12px] text-[var(--muted)]">{p.code}</div>
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {dateFmt.format(new Date(p.startsAt))} – {dateFmt.format(new Date(p.endsAt))}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{p._count.categories}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium ${statusClass[p.status]}`}
                  >
                    {statusLabel[p.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof PeriodePage>) { await requirePageAdmin(); return PeriodePage(...args); }
