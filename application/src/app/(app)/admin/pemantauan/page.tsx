import Link from "next/link";
import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { getPeriodMonitoring, listMonitorablePeriods } from "@/lib/services/monitoring";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { StatusPill } from "@/components/theme/status-pill";
import { PilihPeriode } from "./pilih-periode";
import { DaftarPenilai } from "./daftar-penilai";
import { DaftarObjekKurang } from "./daftar-objek-kurang";

/**
 * Pemantauan satu periode. Versi sebelumnya berisi angka gabungan seluruh periode ("Tingkat
 * pengiriman", "Perhitungan tertunda", "Objek di bawah minimum") tanpa nama siapa pun, sehingga
 * admin tidak tahu apa yang harus dilakukan. Halaman ini menjawab tiga pertanyaan: sudah sejauh
 * mana, siapa yang perlu diingatkan, dan objek mana yang perlu ditambah penilainya.
 */

const statusPeriode: Record<string, { label: string; tone: "proses" | "perhatian" | "selesai" | "arsip" | "netral" }> = {
  SIAP: { label: "Siap dibuka", tone: "perhatian" },
  AKTIF: { label: "Sedang berjalan", tone: "proses" },
  DITUTUP: { label: "Ditutup", tone: "netral" },
  FINAL: { label: "Final", tone: "arsip" },
  REVISI: { label: "Revisi", tone: "perhatian" },
};

const jenisLaporan: Record<string, string> = {
  OBJEK_KELIRU: "Objek keliru",
  UNIT_KELIRU: "Unit keliru",
  PENGGUNA_NONAKTIF: "Pengguna nonaktif",
  TAUTAN_KARYA_SALAH: "Tautan karya salah",
  LAINNYA: "Lainnya",
};

const tanggal = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const angka = new Intl.NumberFormat("id-ID");
const persen = (n: number) => `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n)}%`;

function kalimatTenggat(status: string, endsAt: Date) {
  const sisaHari = Math.ceil((endsAt.getTime() - Date.now()) / 864e5);
  if (status === "AKTIF") {
    if (sisaHari > 1) return `Tenggat ${tanggal.format(endsAt)} — sisa ${sisaHari} hari.`;
    if (sisaHari === 1) return `Tenggat ${tanggal.format(endsAt)} — besok.`;
    if (sisaHari <= 0) return `Tenggat ${tanggal.format(endsAt)} sudah lewat; pengisian belum ditutup.`;
  }
  return `Tenggat ${tanggal.format(endsAt)}.`;
}

async function PemantauanPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
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
  const objekKurangUnik = d.objekKurang.length;
  const berjalan = d.period.status === "AKTIF" && d.period.endsAt > new Date();
  const lebar = (n: number) => `${d.total ? (n / d.total) * 100 : 0}%`;

  return (
    <div className="space-y-8">
      <PageIntro title="Pemantauan" intro="Sejauh mana pengisian dan siapa yang perlu ditindaklanjuti.">
        <SummaryCard
          tone="kuning"
          label="Penilaian masuk"
          value={persen(d.persen)}
          note={`${angka.format(d.terkirim)} dari ${angka.format(d.total)} tugas`}
        />
        <SummaryCard
          tone="biru"
          label="Belum selesai"
          value={angka.format(d.penilaiBelum.length)}
          note={`dari ${angka.format(d.jumlahPenilai)} penilai`}
        />
        <SummaryCard
          tone={objekKurangUnik > 0 ? "merah" : "tosca"}
          label="Belum cukup dinilai"
          value={angka.format(objekKurangUnik)}
          note="objek belum bisa masuk peringkat"
        />
      </PageIntro>

      <section className="app-panel app-panel--ruled pantau-periode">
        <div className="pantau-periode__pilih">
          <label className="filter-bar__label" htmlFor="pantau-periode">Periode</label>
          <PilihPeriode
            periodeId={periodeId}
            pilihan={periods.map((p) => ({ value: p.id, label: p.status === "AKTIF" ? p.name : `${p.name} (${statusPeriode[p.status]?.label ?? p.status})` }))}
          />
        </div>
        <div className="pantau-periode__keadaan">
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          <span>{kalimatTenggat(d.period.status, d.period.endsAt)}</span>
        </div>
      </section>

      <section className="app-panel app-panel--ruled">
        <h2 className="app-panel__label">Progres pengisian</h2>
        <p className="pantau-kalimat">
          <strong>{angka.format(d.terkirim)}</strong> dari <strong>{angka.format(d.total)}</strong> tugas penilaian sudah
          dikirim ({persen(d.persen)}). {angka.format(d.penilaiSelesai)} dari {angka.format(d.jumlahPenilai)} penilai sudah
          menyelesaikan semua tugasnya.
        </p>
        <div className="pantau-batang" role="img" aria-label={`Terkirim ${d.terkirim}, draf ${d.draf}, dibuka kembali ${d.dibukaKembali}, belum dibuka ${d.belumMulai}`}>
          <span className="pantau-batang__isi pantau-batang__isi--terkirim" style={{ width: lebar(d.terkirim) }} />
          <span className="pantau-batang__isi pantau-batang__isi--draf" style={{ width: lebar(d.draf + d.dibukaKembali) }} />
        </div>
        <ul className="pantau-legenda">
          <li><i className="pantau-legenda__warna pantau-batang__isi--terkirim" />Sudah dikirim <b>{angka.format(d.terkirim)}</b></li>
          <li><i className="pantau-legenda__warna pantau-batang__isi--draf" />Sedang diisi (draf) <b>{angka.format(d.draf + d.dibukaKembali)}</b></li>
          <li><i className="pantau-legenda__warna" />Belum dibuka <b>{angka.format(d.belumMulai)}</b></li>
        </ul>
      </section>

      <section className="app-panel app-panel--ruled">
        <h2 className="app-panel__label">Per kategori</h2>
        {d.kategori.length === 0 ? (
          <p className="app-empty">Periode ini tidak punya kategori aktif.</p>
        ) : (
          <ul className="pantau-kategori">
            {d.kategori.map((k) => {
              const p = k.tugas ? (k.terkirim / k.tugas) * 100 : 0;
              return (
                <li key={k.id}>
                  <div className="pantau-kategori__kepala">
                    <Link href={`/admin/periode/${periodeId}/kategori/${k.id}?bagian=penugasan`} className="pantau-kategori__nama">
                      {k.nama}
                    </Link>
                    <span className="pantau-kategori__angka">
                      {angka.format(k.terkirim)}/{angka.format(k.tugas)} · {persen(p)}
                    </span>
                  </div>
                  <div className="pantau-batang pantau-batang--tipis">
                    <span className="pantau-batang__isi pantau-batang__isi--terkirim" style={{ width: `${p}%` }} />
                  </div>
                  <p className="pantau-kategori__catatan">
                    {k.jenis} · {k.objek} objek
                    {k.objekKurang > 0 ? (
                      <> · <span className="pantau-kategori__kurang">{k.objekKurang} objek belum cukup dinilai</span></>
                    ) : (
                      " · semua objek sudah cukup dinilai"
                    )}
                    {k.perhitunganGagal && <> · <span className="pantau-kategori__kurang">perhitungan terakhir gagal</span></>}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="app-panel app-panel--ruled">
        <h2 className="app-panel__label">Penilai yang belum selesai ({angka.format(d.penilaiBelum.length)})</h2>
        <p className="pantau-penjelasan">
          Orang yang masih punya tugas belum dikirim — mereka yang perlu diingatkan. <b>Belum dibuka</b>: tugas belum
          disentuh sama sekali. <b>Draf</b>: sudah diisi sebagian tetapi belum dikirim, jadi belum dihitung.
        </p>
        {d.penilaiBelum.length === 0 ? (
          <p className="app-empty">Semua penilai sudah mengirim seluruh tugasnya.</p>
        ) : (
          <DaftarPenilai penilai={d.penilaiBelum} />
        )}
      </section>

      <section className="app-panel app-panel--ruled">
        <h2 className="app-panel__label">Objek yang belum cukup dinilai ({angka.format(objekKurangUnik)})</h2>
        <p className="pantau-penjelasan">
          Objek baru masuk peringkat bila penilaian yang <b>sudah dikirim</b> mencapai <b>minimum</b> di aturan penilai
          kategorinya. Bila penilai yang ditugaskan saja kurang dari minimum, menunggu tidak akan cukup —
          {berjalan ? " tambah penilainya." : " penilai hanya bisa ditambah saat periode Draf atau sedang berjalan."}
        </p>
        {d.objekKurang.length === 0 ? (
          <p className="app-empty">Semua objek sudah memenuhi minimum penilaian.</p>
        ) : (
          <DaftarObjekKurang periodeId={periodeId} objek={d.objekKurang} bisaTambah={berjalan} />
        )}
      </section>

      <section className="app-panel app-panel--ruled">
        <h2 className="app-panel__label">Laporan masalah dari penilai ({d.laporanTerbuka.length})</h2>
        {d.laporanTerbuka.length === 0 ? (
          <p className="app-empty">Tidak ada laporan yang menunggu ditangani.</p>
        ) : (
          <>
            <ul className="pantau-laporan">
              {d.laporanTerbuka.slice(0, 5).map((l) => (
                <li key={l.id}>
                  <strong>{jenisLaporan[l.jenis] ?? l.jenis}</strong> — {l.objek} ({l.kategori})
                  <small>
                    Dilaporkan {l.pelapor}, {tanggal.format(l.dibuat)}: “{l.detail}”
                  </small>
                </li>
              ))}
            </ul>
            <Link href="/admin/masalah" className="pantau-tautan">
              Tangani laporan →
            </Link>
          </>
        )}
      </section>

      {(d.perhitunganGagal.length > 0 || d.perhitunganMacet > 0) && (
        <section className="app-panel app-panel--ruled">
          <h2 className="app-panel__label">Perhitungan hasil bermasalah</h2>
          <p className="pantau-penjelasan">
            {d.perhitunganGagal.length > 0 && <>Perhitungan terakhir gagal pada: {d.perhitunganGagal.join(", ")}. Jalankan ulang dari halaman hasil kategori. </>}
            {d.perhitunganMacet > 0 && <>{d.perhitunganMacet} perhitungan tidak selesai (berhenti di tengah jalan).</>}
          </p>
        </section>
      )}
    </div>
  );
}

export default async function AuthorizedPage(...args: Parameters<typeof PemantauanPage>) {
  await requirePageAdmin();
  return PemantauanPage(...args);
}
