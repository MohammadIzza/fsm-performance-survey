import type { listFinalizationHistory } from "@/lib/services/finalization";
import { withBase } from "@/lib/base-path";

type History = Awaited<ReturnType<typeof listFinalizationHistory>>;

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Bab 14.3: "Hasil final lama tetap dapat dilihat sebagai versi terdahulu." Daftar ini
// menampilkan seluruh revisi finalisasi periode, terbaru di atas.
export function FinalizationHistory({ history }: { history: History }) {
  return (
    <div className="app-panel app-panel--ruled">
      <h2 className="app-panel__label">
        Riwayat finalisasi
      </h2>
      <ul className="space-y-3">
        {history.map((f, i) => (
          <li key={f.id} className="app-note">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--foreground)]">
                Revisi {f.revision} {i === 0 && <span className="text-[var(--success)]">(terkini)</span>}
              </span>
              <span className="app-text-xs text-[var(--muted)]">{dateFmt.format(f.finalizedAt)}</span>
            </div>
            <p className="mt-1 text-[var(--muted)]">
              Oleh {f.finalizedBy.name} · {f.calculationRuns.length} kategori dihitung
            </p>
            <a href={withBase(`/arsip/${f.id}`)} className="mt-2 inline-block text-[var(--accent)] underline">Buka hasil versi ini ↗</a>
            {f.note && <p className="mt-1 text-[var(--muted)]">Catatan: {f.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
