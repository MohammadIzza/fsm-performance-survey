import type { listRiwayatPeriode, JenisRiwayat } from "@/lib/services/finalization";
import { withBase } from "@/lib/base-path";
import { StatusPill } from "@/components/theme/status-pill";

type Riwayat = Awaited<ReturnType<typeof listRiwayatPeriode>>;

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

/** Sebutan alasan per jenis kejadian; jenis lain tidak membawa alasan. */
const labelAlasan: Partial<Record<JenisRiwayat, string>> = {
  final: "Catatan",
  revisi: "Alasan",
  draf: "Alasan",
  "koreksi-selesai": "Catatan",
};

// Bab 14.3: "Hasil final lama tetap dapat dilihat sebagai versi terdahulu." Dulu bagian ini hanya
// berisi daftar finalisasi; pembukaan revisi beserta alasannya hanya bisa dilacak di Audit. Sekarang
// satu linimasa: setiap peralihan periode, terbaru di atas, dengan versi hasil yang bisa dibuka.
export function RiwayatPeriode({ riwayat }: { riwayat: Riwayat }) {
  if (riwayat.length === 0) return null;
  return (
    <div className="app-panel app-panel--ruled">
      <h2 className="app-panel__label">Riwayat periode</h2>
      <ol className="riwayat-periode">
        {riwayat.map((r) => (
          <li key={r.id} className="riwayat-periode__item" data-jenis={r.jenis}>
            <span className="riwayat-periode__titik" aria-hidden="true" />
            <div className="riwayat-periode__isi">
              <p className="riwayat-periode__judul">
                {r.judul}
                {"finalisasi" in r && r.finalisasi?.terkini && <StatusPill tone="selesai">Berlaku</StatusPill>}
              </p>
              <p className="riwayat-periode__meta">
                {dateFmt.format(r.waktu)} · oleh {r.oleh}
                {"finalisasi" in r && r.finalisasi && ` · ${r.finalisasi.kategori} kategori dihitung`}
              </p>
              {r.alasan && labelAlasan[r.jenis] && (
                <p className="riwayat-periode__alasan">
                  <span>{labelAlasan[r.jenis]}:</span> {r.alasan}
                </p>
              )}
            </div>
            {"finalisasi" in r && r.finalisasi && (
              <a href={withBase(`/arsip/${r.finalisasi.id}`)} className="app-btn riwayat-periode__buka">
                Buka hasil versi {r.finalisasi.versi} →
              </a>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
