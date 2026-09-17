import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";
import Link from "next/link";
import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { getPeriodMonitoring, listMonitorablePeriods } from "@/lib/services/monitoring";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { StatusPill } from "@/components/theme/status-pill";
import { PilihPeriode } from "./pilih-periode";
import { TindakLanjut } from "./tindak-lanjut";

/**
 * Pemantauan satu periode, disusun sebagai tiga pertanyaan berurutan:
 *   1. Sudah sejauh mana? — satu kalimat, satu batang, dan tabel ringkas per kategori.
 *   2. Apa yang perlu dilakukan? — daftar tindak lanjut dalam tab, masing-masing dengan satu
 *      kalimat penjelasan, supaya halaman tidak memanjang oleh daftar nama.
 * Versi awal berisi angka gabungan seluruh periode tanpa nama siapa pun.
 */

const statusPeriode: Record<string, { label: string; tone: "proses" | "perhatian" | "selesai" | "arsip" | "netral" }> = {
  SIAP: { label: "Siap dibuka", tone: "perhatian" },
  AKTIF: { label: "Sedang berjalan", tone: "proses" },
  DITUTUP: { label: "Ditutup", tone: "netral" },
  FINAL: { label: "Final", tone: "arsip" },
  REVISI: { label: "Revisi", tone: "perhatian" },
};

const tanggal = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const angka = new Intl.NumberFormat("id-ID");
const persen = (n: number) => `${Math.round(n)}%`;

function keteranganTenggat(status: string, endsAt: Date) {
  const sisaHari = Math.ceil((endsAt.getTime() - Date.now()) / 864e5);
  const tgl = tanggal.format(endsAt);
  if (status !== "AKTIF") return `Tenggat ${tgl}`;
  if (sisaHari > 1) return `Tenggat ${tgl} · sisa ${sisaHari} hari`;
  if (sisaHari === 1) return `Tenggat ${tgl} · besok`;
  return `Tenggat ${tgl} sudah lewat`;
}

async function PemantauanPage({ searchParams }: { searchParams: Promise<{ periode?: string; bagian?: string }> }) {
  const sp = await searchParams;
  const periods = await listMonitorablePeriods();

  if (periods.length === 0) {
    return (
      <div className="space-y-8">
        <PageIntro title="Pemantauan" intro="Pantau pengisian periode yang sudah dibuka." />
        <p className="app-empty">Belum ada periode yang dibuka. Pemantauan tersedia setelah pengisian dibuka.</p>
      </div>
    );
  }

  const periodeId = periods.some((p) => p.id === sp.periode) ? sp.periode! : periods[0].id;
  const d = (await getPeriodMonitoring(periodeId))!;
  const status = statusPeriode[d.period.status] ?? { label: d.period.status, tone: "netral" as const };
  const berjalan = d.period.status === "AKTIF" && d.period.endsAt > new Date();
  const sedangDiisi = d.draf + d.dibukaKembali;
  const lebar = (n: number) => `${d.total ? (n / d.total) * 100 : 0}%`;

  return (
    <div className="space-y-8">
      <PageIntro title="Pemantauan" intro="Sejauh mana pengisian, dan apa yang perlu ditindaklanjuti.">
        <SummaryCard
          tone="kuning"
          label={<>Sudah dikirim<Info>{KET.sudahDikirim}</Info></>}
          value={persen(d.persen)}
          note={`${angka.format(d.terkirim)} dari ${angka.format(d.total)} tugas`}
        />
        <SummaryCard
          tone="biru"
          label={<>Penilai belum selesai<Info>{KET.penilaiBelumSelesai}</Info></>}
          value={angka.format(d.penilaiBelum.length)}
          note={`dari ${angka.format(d.jumlahPenilai)} penilai`}
        />
        <SummaryCard
          tone={d.objekKurang.length > 0 ? "merah" : "tosca"}
          label={<>Belum cukup dinilai<Info>{KET.belumCukup}</Info></>}
          value={angka.format(d.objekKurang.length)}
          note="objek belum masuk peringkat"
        />
      </PageIntro>

      <div className="pantau-periode">
        <div className="pantau-periode__pilih">
          <label className="filter-bar__label" htmlFor="pantau-periode">
            Periode
          </label>
          <PilihPeriode
            periodeId={periodeId}
            pilihan={periods.map((p) => ({
              value: p.id,
              label: p.status === "AKTIF" ? p.name : `${p.name} (${statusPeriode[p.status]?.label ?? p.status})`,
            }))}
          />
        </div>
        <p className="pantau-periode__keadaan">
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          <span>{keteranganTenggat(d.period.status, d.period.endsAt)}</span>
        </p>
      </div>

      <section className="app-panel app-panel--ruled">
        <h2 className="app-panel__label">Sudah sejauh mana</h2>
        <div className="pantau-batang" aria-hidden="true">
          <span className="pantau-batang__isi pantau-warna--terkirim" style={{ width: lebar(d.terkirim) }} />
          <span className="pantau-batang__isi pantau-warna--draf" style={{ width: lebar(sedangDiisi) }} />
        </div>
        <ul className="pantau-legenda">
          <li>
            <i className="pantau-warna--terkirim" /> Sudah dikirim <b>{angka.format(d.terkirim)}</b>
          </li>
          <li>
            <i className="pantau-warna--draf" /> Sedang diisi<Info>{KET.sedangDiisi}</Info> <b>{angka.format(sedangDiisi)}</b>
          </li>
          <li>
            <i /> Belum dibuka <b>{angka.format(d.belumMulai)}</b>
          </li>
        </ul>

        {d.kategori.length > 0 && (
          <div className="app-table-wrap pantau-kategori">
            <table className="pantau-tabel">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th className="pantau-tabel__progres">Sudah dikirim</th>
                  <th className="pantau-tabel__angka">Belum cukup dinilai<Info>{KET.belumCukup}</Info></th>
                </tr>
              </thead>
              <tbody>
                {d.kategori.map((k) => {
                  const p = k.tugas ? (k.terkirim / k.tugas) * 100 : 0;
                  return (
                    <tr key={k.id}>
                      <td data-label="Kategori">
                        <Link href={`/admin/periode/${periodeId}/kategori/${k.id}?bagian=penugasan`} className="pantau-kategori__nama">
                          {k.nama}
                        </Link>
                        <small>
                          {k.jenis} · {k.objek} objek{k.perhitunganGagal && " · perhitungan terakhir gagal"}
                        </small>
                      </td>
                      <td data-label={<>Sudah dikirim<Info>{KET.sudahDikirim}</Info></>} className="pantau-tabel__progres">
                        <span className="pantau-progres">
                          <span className="pantau-batang pantau-batang--tipis">
                            <span className="pantau-batang__isi pantau-warna--terkirim" style={{ width: `${p}%` }} />
                          </span>
                          <span className="pantau-progres__angka">
                            {persen(p)} <small>{angka.format(k.terkirim)}/{angka.format(k.tugas)}</small>
                          </span>
                        </span>
                      </td>
                      <td data-label={<>Belum cukup dinilai<Info>{KET.belumCukup}</Info></>} className="pantau-tabel__angka">
                        {k.objekKurang > 0 ? (
                          <span className="pantau-merah">
                            {k.objekKurang} objek<span className="pantau-seluler"> belum cukup dinilai</span>
                          </span>
                        ) : (
                          <span className="pantau-hijau">Semua<span className="pantau-seluler"> objek</span> cukup<span className="pantau-seluler"> dinilai</span></span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="app-panel app-panel--ruled">
        <h2 className="app-panel__label">Yang perlu ditindaklanjuti</h2>
        <TindakLanjut
          periodeId={periodeId}
          bisaTambah={berjalan || d.period.status === "DRAF"}
          penilai={d.penilaiBelum}
          objek={d.objekKurang}
          bagian={sp.bagian}
        />
        {(d.perhitunganGagal.length > 0 || d.perhitunganMacet > 0) && (
          <p className="pantau-petunjuk pantau-merah">
            {d.perhitunganGagal.length > 0 && `Perhitungan hasil terakhir gagal pada: ${d.perhitunganGagal.join(", ")}. `}
            {d.perhitunganMacet > 0 && `${d.perhitunganMacet} perhitungan berhenti di tengah jalan.`}
          </p>
        )}
      </section>
    </div>
  );
}

export default async function AuthorizedPage(...args: Parameters<typeof PemantauanPage>) {
  await requirePageAdmin();
  return PemantauanPage(...args);
}
