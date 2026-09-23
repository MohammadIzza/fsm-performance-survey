"use client";

import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";

import { useState, type ReactNode } from "react";
import type { RankedEntry } from "@/lib/services/rankings";
import {
  DataList,
  DataRow,
  RowActions,
  RowField,
  RowPanelDetails,
  RowPanelField,
  RowTitle,
  type RowKind,
} from "@/components/theme/data-list";
import { StatusPill } from "@/components/theme/status-pill";
import { FilterBar, FilterField } from "@/components/theme/filter-bar";
import { TextInput } from "@/components/theme/form-field";
import { withBase } from "@/lib/base-path";

export interface DetailData {
  parameterResults: {
    parameterName: string;
    aggregate: number;
    contribution: number;
    weight: number;
    /** Agregat sebelum dinormalisasi; hanya ada pada parameter bernilai mentah. */
    rawAggregate?: number | null;
  }[];
  respondents: { evaluatorName: string; evaluatorLogin: string; submittedAt: string | null; scores: { parameterName: string; score: number }[] }[];
}

/**
 * Predikat nilai di bawah angkanya. Warnanya mengikuti tingkat — tertinggi tosca, terendah merah —
 * sebagai teks berwarna saja, tanpa lencana, supaya kolom Nilai tetap terbaca sebagai satu angka
 * dengan keterangan, bukan dua tanda yang bersaing.
 */
function PredikatLabel({ band }: { band: NonNullable<RankedEntry["band"]> }) {
  // Tingkat dipetakan ke 0..3 supaya susunan 2 sampai 6 tingkat memakai palet yang sama.
  const posisi = band.total <= 1 ? 0 : Math.round((band.level / (band.total - 1)) * 3);
  return (
    <span
      className={`leaderboard-predikat leaderboard-predikat--${posisi}`}
      title={`${band.persen}% dari nilai maksimum`}
    >
      {band.label}
    </span>
  );
}

const eligibilityLabel: Record<RankedEntry["eligibility"], string> = {
  BELUM_ADA_PENILAIAN: "Belum ada penilaian",
  BELUM_MEMENUHI_MINIMUM: "Belum memenuhi minimum",
  MEMENUHI_SYARAT: "Memenuhi syarat",
};

/** Bentuk pendek untuk papan yang berdampingan: di kolom selebar sepertiga layar, teks panjang
    meluber menutupi bidang di sebelahnya. Yang panjang tetap ada dan dipakai layar sempit. */
const eligibilityLabelPendek: Record<RankedEntry["eligibility"], string> = {
  BELUM_ADA_PENILAIAN: "Belum dinilai",
  BELUM_MEMENUHI_MINIMUM: "Kurang",
  MEMENUHI_SYARAT: "Memenuhi",
};

function StatusKelayakan({ eligibility }: { eligibility: RankedEntry["eligibility"] }) {
  return (
    <StatusPill tone={eligibilityTone[eligibility]}>
      <span className="leaderboard-status__panjang">{eligibilityLabel[eligibility]}</span>
      <span className="leaderboard-status__pendek" aria-hidden="true">
        {eligibilityLabelPendek[eligibility]}
      </span>
    </StatusPill>
  );
}

const eligibilityTone: Record<RankedEntry["eligibility"], "selesai" | "perhatian" | "netral"> = {
  MEMENUHI_SYARAT: "selesai",
  BELUM_MEMENUHI_MINIMUM: "perhatian",
  BELUM_ADA_PENILAIAN: "netral",
};

/**
 * Leaderboard satu kelompok penilai.
 *
 * Memakai daftar data yang sama dengan daftar di panel admin (DataList + DataRow) — kepala kolom,
 * garis baris, kolom Aksi dengan tombol buka-tutup, panel detail di bawah barisnya, dan susunan
 * bertumpuk di ponsel. Sebelumnya leaderboard punya dua tampilan sendiri: <table> di layar lebar
 * dengan lencana bulat dan tanda ▼ berupa teks, lalu kartu terpisah di ponsel — tidak satu pun
 * yang serupa dengan daftar lain di aplikasi.
 */
export function LeaderboardTable({
  entries,
  minimum,
  minimumText,
  showDetail,
  detailByObject,
  searchTerm,
}: {
  entries: RankedEntry[];
  minimum: number;
  /** Pengganti "min. N" pada kolom Respons, mis. untuk papan gabungan dua kelompok. */
  minimumText?: string;
  showDetail: boolean;
  detailByObject?: Map<string, DetailData>;
  /** Bab 13.2: pencarian hanya menyaring tampilan, peringkat yang sudah dihitung tidak berubah. */
  searchTerm?: string;
}) {
  if (entries.length === 0) {
    return <p className="app-empty">Belum ada penilaian.</p>;
  }

  const term = searchTerm?.trim().toLowerCase();
  const visible = term
    ? entries.filter((e) => e.objectName.toLowerCase().includes(term))
    : entries;

  if (visible.length === 0) {
    return (
      <p className="app-empty">
        Tidak ada objek yang cocok dengan &ldquo;{searchTerm}&rdquo; pada lingkup ini.
      </p>
    );
  }

  return (
    <div className="leaderboard-list">
      <DataList
        // Kepala kolom memuat ikon keterangan yang bisa difokus, jadi tidak boleh aria-hidden.
        columnHeaderHidden={false}
        // Susunannya satu macam untuk semua lebar: unit ikut nama objek, dan sisanya bidang
        // pendek. Yang membedakan papan berdampingan dari papan selebar halaman hanyalah CSS —
        // bidang Respons disembunyikan saat papannya tiga, dan status memakai teks pendeknya.
        columns={[
          ["title", "Objek"],
          ["location", <>Respons<Info>{KET.respons}</Info></>],
          ["topic", <>Nilai<Info>{KET.nilaiAkhir}</Info></>],
          ["dates", <>Status<Info>{KET.statusKelayakan}</Info></>],
          // Papan gabungan tidak punya panel detail, jadi kolom Aksi-nya pun tidak ada — kepala
          // kolom "Aksi" tanpa tombol apa pun di bawahnya hanya menyisakan kolom kosong.
          ...(showDetail ? ([["price", "Aksi"]] as [RowKind, ReactNode][]) : []),
        ]}
      >
        {visible.map((e) => (
          <EntryRow
            key={e.categoryObjectId}
            entry={e}
            minimum={minimum}
            minimumText={minimumText}
            detail={showDetail ? detailByObject?.get(e.categoryObjectId) : undefined}
            adaKolomAksi={showDetail}
          />
        ))}
      </DataList>
    </div>
  );
}

/**
 * Nomor peringkat di depan nama objek. Tiga teratas memakai mahkota emas, perak, dan perunggu —
 * aset yang sama dipakai seksi peringkat di beranda — supaya papan ini tetap terbaca sebagai
 * papan peringkat tanpa perlu lencana buatan sendiri.
 */
function Peringkat({ rank, tied }: { rank: number | null; tied?: boolean }) {
  const mahkota = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : null;
  return (
    <span
      className="leaderboard-rank"
      aria-label={rank ? `Peringkat ${rank}${tied ? ", seri" : ""}` : "Belum berperingkat"}
    >
      {mahkota && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="leaderboard-rank__crown"
          src={withBase(`/assets/images/icon-crown-${mahkota}.svg`)}
          alt=""
          width={16}
          height={16}
        />
      )}
      {rank === null ? (
        // Objek yang belum berperingkat: slotnya tetap selebar nomor supaya nama di bawahnya
        // tetap rata, tapi dibiarkan kosong — tanda hubung di kolom nomor terbaca seperti angka.
        <span className="leaderboard-rank__number leaderboard-rank__number--kosong" aria-hidden="true" />
      ) : (
        <span className="leaderboard-rank__number">{rank}</span>
      )}
      {/* Nilai yang tetap sama setelah parameter pembeda dipakai: peringkatnya dibagi, dan
          keputusannya masih terbuka — ditandai supaya tidak dibaca sebagai urutan pasti. */}
      {tied && <span className="leaderboard-rank__seri" title="Nilai sama persis dengan objek lain">seri</span>}
    </span>
  );
}

function EntryRow({
  entry,
  minimum,
  minimumText,
  detail,
  adaKolomAksi,
}: {
  entry: RankedEntry;
  minimum: number;
  minimumText?: string;
  detail?: DetailData;
  /** Papannya punya kolom Aksi; baris tanpa tombol tetap mengisinya supaya bidang lain sejajar. */
  adaKolomAksi: boolean;
}) {
  const bisaDibuka = !!detail;
  const respons = `${entry.responseCount}${
    entry.eligibility !== "MEMENUHI_SYARAT" ? ` / ${minimumText ?? `min. ${minimum}`}` : ""
  }`;
  const nilai = entry.score !== null ? entry.score.toFixed(2) : null;

  return (
    <DataRow
      collapsible={bisaDibuka}
      // Panel di sini hanya dibaca, tidak ada isian yang bisa hilang, dan isinya panjang: dua panel
      // terbuka sekaligus mendorong papan peringkatnya keluar layar ponsel. Lingkupnya seluruh
      // papan, bukan satu papan saja: di ponsel ketiganya tersusun menurun dalam satu layar.
      bukaTunggal=".leaderboard-columns"
      panel={
        bisaDibuka ? (
          <div className="admin-row-panel">
            {/* Unit dan respons ikut diulang di sini: di ponsel keduanya disembunyikan dari
                baris, dan panel inilah satu-satunya tempat membacanya. */}
            <RowPanelDetails>
              <RowPanelField label="Unit">{entry.unitName}</RowPanelField>
              <RowPanelField label="Respons">{respons}</RowPanelField>
              <RowPanelField label="Nilai">{nilai ?? "Belum ada nilai"}</RowPanelField>
              {entry.band && (
                <RowPanelField label="Predikat">
                  <PredikatLabel band={entry.band} />
                </RowPanelField>
              )}
              {/* Teks biasa, bukan lencana: di dalam panel ia satu dari beberapa keterangan
                  berlabel, dan lencana berlatar di antara teks polos terbaca seperti tombol.
                  Lencananya tetap dipakai di barisnya sendiri, tempat ia memang jadi penanda. */}
              <RowPanelField label="Status">{eligibilityLabel[entry.eligibility]}</RowPanelField>
            </RowPanelDetails>
            <DetailPanel detail={detail} />
          </div>
        ) : undefined
      }
    >
      <RowTitle>
        <Peringkat rank={entry.rank} tied={entry.tied} />
        {/* Nama objek dengan unitnya sebagai baris kecil di bawahnya. Sebagai kolom tersendiri,
            nama unit ("Departemen Informatika") memakan sepertiga lebar papan yang berdampingan
            dan memaksa nama objeknya patah jadi tiga baris. */}
        <span className="leaderboard-objek">
          <span className="leaderboard-objek__nama">{entry.objectName}</span>
          <span className="leaderboard-objek__unit">{entry.unitName}</span>
        </span>
      </RowTitle>
      <RowField kind="location" icon={false} detail>
        {/* Papan gabungan tidak punya panel detail, jadi di ponsel angka ini tetap di barisnya —
            tanpa kepala kolom di atasnya. Namanya ikut ditulis di sana supaya "0 / min. 1 + 1"
            tidak terbaca sebagai angka tanpa arti; di papan lain label ini disembunyikan. */}
        <span className="leaderboard-respons">
          <span className="leaderboard-respons__label">Respons </span>
          {respons}
        </span>
      </RowField>
      <RowField kind="topic" icon={false}>
        {nilai === null ? (
          <span className="leaderboard-score leaderboard-score--kosong">Belum ada</span>
        ) : (
          <span className="leaderboard-score">{nilai}</span>
        )}
        {entry.band && <PredikatLabel band={entry.band} />}
      </RowField>
      <RowField kind="dates" icon={false}>
        <StatusKelayakan eligibility={entry.eligibility} />
      </RowField>
      {/* Tanpa detail tidak ada tombol buka-tutup; kolom Aksi tetap diisi supaya bidang lain
          tidak bergeser dari kepala kolomnya. */}
      {!bisaDibuka && adaKolomAksi && <RowActions>{null}</RowActions>}
    </DataRow>
  );
}

function DetailPanel({ detail }: { detail: DetailData }) {
  return (
    <>
      {detail.parameterResults.length > 0 && (
        <section className="admin-row-section">
          <h3 className="app-panel__label app-panel__label--tight">Agregasi per parameter</h3>
          <ul className="leaderboard-detail">
            {detail.parameterResults.map((p) => (
              <li key={p.parameterName}>
                <span>
                  {p.parameterName} <span className="leaderboard-detail__muted">({p.weight}%)</span>
                </span>
                <span className="leaderboard-detail__muted">
                  {p.rawAggregate != null && <>mentah {p.rawAggregate.toFixed(2)} → </>}
                  {p.aggregate.toFixed(2)} → {p.contribution.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="admin-row-section">
        <h3 className="app-panel__label app-panel__label--tight">Penilai yang berkontribusi</h3>
        {detail.respondents.length === 0 ? (
          <p className="app-text-xs">Belum ada jawaban terkirim.</p>
        ) : (
          <PenilaiTabel detail={detail} />
        )}
      </section>
    </>
  );
}

/**
 * Nilai tiap penilai sebagai tabel: satu baris satu penilai, satu kolom satu parameter. Sebelumnya
 * deretan "Ramah: 12 · Baik: 12 · Sopan: 12" yang membungkus beberapa baris — nilai penilai yang
 * satu tidak bisa dibandingkan dengan penilai lain tanpa membacanya kata demi kata.
 *
 * Urutan kolom mengikuti urutan parameter pada hasil agregasi supaya sama dengan tabel di atasnya;
 * parameter yang tidak ada pada hasil (mis. jawaban lama) tetap diikutkan di belakang.
 */
function PenilaiTabel({ detail }: { detail: DetailData }) {
  const kolom: string[] = detail.parameterResults.map((p) => p.parameterName);
  for (const r of detail.respondents) {
    for (const s of r.scores) if (!kolom.includes(s.parameterName)) kolom.push(s.parameterName);
  }

  return (
    <div className="penilai-tabel-wrap">
      <table className="penilai-tabel">
        <thead>
          <tr>
            <th scope="col">Penilai</th>
            {kolom.map((nama) => (
              <th key={nama} scope="col">
                {nama}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {detail.respondents.map((r, i) => {
            const nilai = new Map(r.scores.map((s) => [s.parameterName, s.score]));
            return (
              <tr key={i}>
                <th scope="row">
                  <span className="penilai-tabel__nama">{r.evaluatorName}</span>
                  <span className="penilai-tabel__id">{r.evaluatorLogin}</span>
                </th>
                {kolom.map((nama) => (
                  <td key={nama}>{nilai.get(nama) ?? "—"}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Bab 13.2/AC-35: satu kotak pencarian bersama untuk kedua kelompok — objek yang sama bisa
    muncul di kedua leaderboard, dan pencarian hanya menyaring tampilan, tidak menghitung ulang
    ataupun mengubah peringkat yang sudah ada. */
export function LeaderboardGroups({
  pimpinanEntries,
  pimpinanMinimum,
  pimpinanDetail,
  selainEntries,
  selainMinimum,
  selainDetail,
  gabungan,
  action,
}: {
  /** Peringkat gabungan kedua kelompok; hanya ada bila kategori menetapkan bobot gabungan. */
  gabungan?: { entries: RankedEntry[]; pimpinanWeight: number } | null;
  /** Tindakan di ujung bilah penyaring, sejajar dengan kolom cari — mis. tombol Unduh Excel. */
  action?: ReactNode;
  pimpinanEntries: RankedEntry[];
  pimpinanMinimum: number;
  pimpinanDetail?: Map<string, DetailData>;
  selainEntries: RankedEntry[];
  selainMinimum: number;
  selainDetail?: Map<string, DetailData>;
}) {
  const [search, setSearch] = useState("");

  // Aliran blok, bukan petak. Pada petak, lebar min-content bawaan kolom cari (20 karakter,
  // sekitar 480px pada huruf ponsel) menjadi lantai lebar jalurnya — dan min-width:0 pada
  // kolomnya sendiri tidak menembus lantai itu di Chrome — sehingga seluruh isi meluber
  // melewati tepi layar ponsel.
  return (
    <div className="space-y-6">
      {/* Bilah penyaring yang sama dipakai daftar Pengguna dan Objek: label kecil kapital, kolom
          cari berlebar terbatas, dan tindakan halaman di ujungnya — bukan kolom cari selebar
          halaman dengan tombol yang berdiri sendiri di atasnya. */}
      <FilterBar>
        <FilterField label="Cari objek" htmlFor="cari-objek-leaderboard" wide>
          <TextInput
            id="cari-objek-leaderboard"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nama objek di kedua leaderboard…"
          />
        </FilterField>
        {action && <div className="filter-bar__action">{action}</div>}
      </FilterBar>

      <div className={`leaderboard-columns${gabungan ? " leaderboard-columns--three" : ""}`}>
        <section className="leaderboard-columns__panel">
          <h2 className="app-panel__label">Leaderboard Pimpinan<Info>{KET.kelompok}</Info></h2>
          <LeaderboardTable
            entries={pimpinanEntries}
            minimum={pimpinanMinimum}
            showDetail
            detailByObject={pimpinanDetail}
            searchTerm={search}
          />
        </section>
        {gabungan && (
          <section className="leaderboard-columns__panel leaderboard-columns__panel--gabungan">
            <h2 className="app-panel__label">
              Leaderboard Gabungan<Info>{KET.nilaiGabungan}</Info>
              {/* Susunan bobotnya keterangan judul, bukan bagian namanya: di ponsel ia turun jadi
                  baris kecil sendiri, sehingga ikon keterangan tetap menempel pada judulnya. */}
              <span className="leaderboard-bobot">
                Pimpinan {gabungan.pimpinanWeight}% + Selain Pimpinan {100 - gabungan.pimpinanWeight}%
              </span>
            </h2>
            <LeaderboardTable
              entries={gabungan.entries}
              minimum={pimpinanMinimum + selainMinimum}
              minimumText={`min. ${pimpinanMinimum} + ${selainMinimum}`}
              showDetail={false}
              searchTerm={search}
            />
          </section>
        )}
        <section className="leaderboard-columns__panel">
          <h2 className="app-panel__label">Leaderboard Selain Pimpinan<Info>{KET.kelompok}</Info></h2>
          <LeaderboardTable
            entries={selainEntries}
            minimum={selainMinimum}
            showDetail
            detailByObject={selainDetail}
            searchTerm={search}
          />
        </section>
      </div>
    </div>
  );
}
