import { InfoLabel } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { getPeriodScope } from "@/lib/authz";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext } from "@/lib/authz";
import { getLatestRun, getGroupDetailBulk } from "@/lib/services/calculations";
import { getCombinedRanking, getRanking } from "@/lib/services/rankings";
import { isResultAccessOpenForNonAdmin, describeAccessCondition } from "@/lib/services/resultAccess";
import { LeaderboardGroups, type DetailData } from "@/components/leaderboard-table";
import { withBase } from "@/lib/base-path";

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });

export default async function HasilDetailPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return (
      <div className="app-empty-box">
        <p className="font-medium text-[var(--foreground)]">Tidak berwenang</p>
      </div>
    );
  }
  // Pengguna biasa boleh membaca papan peringkat, tetapi hanya hasil yang sudah ditetapkan dan
  // hanya angka akhirnya: rincian per parameter dan daftar penilai tetap tertutup bagi mereka.
  const berwenang = ctx.isAdmin || ctx.isDekan || ctx.leadershipUnitIds.length > 0;

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { period: { include: { accessPolicy: true } }, groupRules: true },
  });
  if (!category) notFound();

  // Bab 4.3/13.5: EDGE-19/EDGE-18 — waktu akses diperiksa sebelum data ditampilkan (tidak
  // membocorkan angka melalui pesan error), dan Admin tidak terhalang jadwal ini. Pengguna biasa
  // menghadapi satu syarat tambahan: hasilnya harus sudah final, bukan sekadar jendela aksesnya
  // terbuka.
  const kebijakan = category.period.accessPolicy;
  const jadwalTerbuka = kebijakan
    ? isResultAccessOpenForNonAdmin({
        mode: kebijakan.mode,
        availableAt: kebijakan.availableAt,
        periodStatus: category.period.status,
      })
    : false;
  const accessOpen =
    ctx.isAdmin || (jadwalTerbuka && (berwenang || category.period.status === "FINAL"));

  if (!accessOpen) {
    return (
      <div className="space-y-4">
        <Link href="/hasil" className="app-text-sm text-[var(--muted)] hover:underline">
          ← Hasil &amp; Leaderboard
        </Link>
        <div className="app-empty-box">
          <p className="font-medium text-[var(--foreground)]">Hasil belum dapat diakses</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {/* Bagi pengguna biasa syaratnya bukan jendela akses, melainkan hasil yang sudah
                ditetapkan. Menyebut jendela akses di situ justru menyesatkan: jendelanya bisa
                saja sedang terbuka, tetapi hasilnya memang belum final. */}
            {!berwenang && category.period.status !== "FINAL"
              ? "Papan peringkat tampil setelah panitia menetapkan hasil akhir."
              : kebijakan
                ? describeAccessCondition(kebijakan.mode, kebijakan.availableAt)
                : "Kebijakan akses belum ditetapkan."}
          </p>
        </div>
      </div>
    );
  }

  const latestRun = await getLatestRun(categoryId);
  const pimpinanRule = category.groupRules.find((r) => r.group === "PIMPINAN");
  const selainRule = category.groupRules.find((r) => r.group === "SELAIN_PIMPINAN");

  let pimpinanEntries: Awaited<ReturnType<typeof getRanking>> = [];
  let selainEntries: Awaited<ReturnType<typeof getRanking>> = [];
  let gabungan: Awaited<ReturnType<typeof getCombinedRanking>> = null;
  let pimpinanDetail: Map<string, DetailData> | undefined;
  let selainDetail: Map<string, DetailData> | undefined;

  // undefined = seluruh peserta. Bagi pengguna biasa lingkup unit tidak berlaku: yang diumumkan
  // adalah peringkat utuh kategori itu, bukan potongan unitnya sendiri (yang justru kosong).
  const lingkup = berwenang ? await getPeriodScope(ctx, category.periodId) : undefined;

  if (latestRun) {
    const [pAll, sAll] = await Promise.all([
      getRanking({ categoryId, group: "PIMPINAN", unitIds: lingkup }),
      getRanking({ categoryId, group: "SELAIN_PIMPINAN", unitIds: lingkup }),
    ]);
    // Bab 13.5/EDGE-19/EDGE-20: dipangkas ke unit objek dalam lingkup aktor SETELAH ranking
    // dihitung atas seluruh populasi, supaya nomor peringkat tetap benar secara global lalu
    // ditampilkan sebagai subset — bukan diranking ulang dari subset yang terlihat.
    pimpinanEntries = pAll;
    selainEntries = sAll;
    gabungan = await getCombinedRanking({ categoryId, unitIds: lingkup });

    const visibleIds = new Set([...pimpinanEntries, ...selainEntries].map((e) => e.categoryObjectId));

    const [pimpinanBulk, selainBulk] = berwenang
      ? await Promise.all([
          getGroupDetailBulk(categoryId, "PIMPINAN"),
          getGroupDetailBulk(categoryId, "SELAIN_PIMPINAN"),
        ])
      : [null, null];

    function toDetailMap(bulk: Awaited<ReturnType<typeof getGroupDetailBulk>>) {
      if (!bulk) return undefined;
      const map = new Map<string, DetailData>();
      for (const [objId, data] of bulk.byObject) {
        if (!visibleIds.has(objId)) continue; // jangan bocorkan detail objek di luar lingkup
        map.set(objId, {
          parameterResults: data.result.parameterResults.map((pr) => ({
            parameterName: pr.parameter.name,
            aggregate: pr.aggregate,
            contribution: pr.contribution,
            weight: pr.parameter.weight,
            rawAggregate: pr.rawAggregate,
          })),
          respondents: data.respondents.map((r) => ({
            ...r,
            submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
          })),
        });
      }
      return map;
    }
    pimpinanDetail = toDetailMap(pimpinanBulk);
    selainDetail = toDetailMap(selainBulk);
  }

  const scopeLabel =
    ctx.isAdmin || ctx.isDekan || !berwenang
      ? "Seluruh fakultas"
      : "Unit yang Anda pimpin dan subunitnya";

  // `admin-area` di sini bukan penanda hak akses: kelas itu lingkup gaya daftar data aplikasi —
  // tata letak kolom, tombol buka-tutup baris, panel detail, dan susunan ponsel. Tanpanya daftar
  // leaderboard di halaman ini tampil sebagai baris tema polos, berbeda dari leaderboard yang
  // sama di halaman hasil admin dan dari daftar lain di panel admin.
  return (
    <div className="admin-area space-y-8">
      <Link href="/hasil" className="app-back">
        ← Hasil &amp; Leaderboard
      </Link>
      <PageIntro title={category.name} intro={category.period.name}>
        <SummaryCard
          tone={category.period.status === "FINAL" ? "tosca" : "kuning"}
          label={<InfoLabel ket={KET.sementara}>Nilai</InfoLabel>}
          value={category.period.status === "FINAL" ? "Final" : "Sementara"}
          note={category.period.status === "FINAL" ? "sudah dikunci" : "masih dapat berubah"}
        />
        <SummaryCard tone="biru" label="Lingkup" value={scopeLabel} />
        <SummaryCard
          tone="kuning"
          label="Peringkat"
          value={pimpinanEntries.length + selainEntries.length}
          note="di kedua kelompok"
        />
      </PageIntro>

      {!latestRun ? (
        <p className="app-empty">Belum ada penilaian.</p>
      ) : (
        <LeaderboardGroups
          pimpinanEntries={pimpinanEntries}
          pimpinanMinimum={pimpinanRule?.minimum ?? 0}
          pimpinanDetail={pimpinanDetail}
          selainEntries={selainEntries}
          selainMinimum={selainRule?.minimum ?? 0}
          selainDetail={selainDetail}
          gabungan={gabungan}
          action={
            berwenang ? (
              <a href={withBase(`/hasil/${categoryId}/export`)} className="app-btn">
                Unduh Excel
              </a>
            ) : undefined
          }
        />
      )}

      <p className="app-text-xs text-[var(--muted)]">
        {latestRun ? `Dihitung ${dateFmt.format(latestRun.createdAt)}` : "Belum pernah dihitung"}
      </p>
    </div>
  );
}
