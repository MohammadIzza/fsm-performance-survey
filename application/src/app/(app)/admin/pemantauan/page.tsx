import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { getMonitoringSummary } from "@/lib/services/monitoring";
import { PageHero } from "@/components/page-hero";

const statusLabel: Record<string, string> = {
  BELUM_MULAI: "Belum mulai",
  DRAF: "Draf",
  TERKIRIM: "Terkirim",
  DIBUKA_KEMBALI: "Dibuka kembali",
  DIBATALKAN: "Dibatalkan",
};

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "danger" | "warning" | "success" }) {
  const toneClass =
    tone === "danger"
      ? "text-[var(--danger)]"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "success"
          ? "text-[var(--success)]"
          : "text-[var(--foreground)]";
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      <p className="text-[12px] font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className={`mt-2 text-[28px] font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

async function PemantauanPage() {
  const summary = await getMonitoringSummary();

  return (
    <div className="space-y-8">
      <PageHero
        compact
        eyebrow="ADMIN · PEMANTAUAN"
        title="Pemantauan"
        description="Ringkasan operasional seluruh fakultas."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Tingkat pengiriman" value={`${summary.submissionRate.toFixed(1)}%`} />
        <StatCard
          label="Perhitungan tertunda"
          value={summary.pendingCalcCount}
          tone={summary.pendingCalcCount > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Perhitungan gagal"
          value={summary.failedCalcCount}
          tone={summary.failedCalcCount > 0 ? "danger" : "success"}
        />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Tugas per status ({summary.validAssignments} berlaku, tidak termasuk yang dibatalkan)
        </h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {summary.assignmentsByStatus.map((s) => (
            <div key={s.status} className="rounded-xl bg-black/[0.02] p-3 text-center">
              <p className="text-[20px] font-semibold text-[var(--foreground)]">{s.count}</p>
              <p className="text-[12px] text-[var(--muted)]">{statusLabel[s.status] ?? s.status}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-[var(--muted)]">
          {summary.submitted} terkirim dari {summary.validAssignments} tugas berlaku.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="mb-2 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Objek di bawah minimum respons
        </h2>
        <p className="text-[15px] text-[var(--foreground)]">
          {summary.belowMinimumObjectCount} objek (dari perhitungan terakhir per kategori) belum
          memenuhi minimum respons atau belum memiliki penilaian sama sekali.
        </p>
      </div>
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof PemantauanPage>) { await requirePageAdmin(); return PemantauanPage(...args); }
