"use client";

import { useState } from "react";
import type { RankedEntry } from "@/lib/services/rankings";
import {
  DataList,
  DataRow,
  RowActions,
  RowField,
  RowPanelDetails,
  RowPanelField,
  RowTitle,
} from "@/components/theme/data-list";
import { StatusPill } from "@/components/theme/status-pill";

export interface DetailData {
  parameterResults: { parameterName: string; aggregate: number; contribution: number; weight: number }[];
  respondents: { evaluatorName: string; evaluatorLogin: string; submittedAt: string | null; scores: { parameterName: string; score: number }[] }[];
}

const eligibilityLabel: Record<RankedEntry["eligibility"], string> = {
  BELUM_ADA_PENILAIAN: "Belum ada penilaian",
  BELUM_MEMENUHI_MINIMUM: "Belum memenuhi minimum",
  MEMENUHI_SYARAT: "Memenuhi syarat",
};

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
  showDetail,
  detailByObject,
  searchTerm,
}: {
  entries: RankedEntry[];
  minimum: number;
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
        columns={[
          ["title", "Objek"],
          ["duration", "Unit"],
          ["location", "Respons"],
          ["topic", "Nilai"],
          ["dates", "Status"],
          ["price", "Aksi"],
        ]}
      >
        {visible.map((e) => (
          <EntryRow
            key={e.categoryObjectId}
            entry={e}
            minimum={minimum}
            detail={showDetail ? detailByObject?.get(e.categoryObjectId) : undefined}
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
function Peringkat({ rank }: { rank: number | null }) {
  const mahkota = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : null;
  return (
    <span className="leaderboard-rank" aria-label={rank ? `Peringkat ${rank}` : "Belum berperingkat"}>
      {mahkota && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="leaderboard-rank__crown"
          src={`/assets/images/icon-crown-${mahkota}.svg`}
          alt=""
          width={16}
          height={16}
        />
      )}
      <span className="leaderboard-rank__number">{rank ?? "—"}</span>
    </span>
  );
}

function EntryRow({
  entry,
  minimum,
  detail,
}: {
  entry: RankedEntry;
  minimum: number;
  detail?: DetailData;
}) {
  const bisaDibuka = !!detail;
  const respons = `${entry.responseCount}${
    entry.eligibility !== "MEMENUHI_SYARAT" ? ` / min. ${minimum}` : ""
  }`;
  const nilai = entry.score !== null ? entry.score.toFixed(2) : "—";

  return (
    <DataRow
      collapsible={bisaDibuka}
      panel={
        bisaDibuka ? (
          <div className="admin-row-panel">
            {/* Unit dan respons ikut diulang di sini: di ponsel keduanya disembunyikan dari
                baris, dan panel inilah satu-satunya tempat membacanya. */}
            <RowPanelDetails>
              <RowPanelField label="Unit">{entry.unitName}</RowPanelField>
              <RowPanelField label="Respons">{respons}</RowPanelField>
              <RowPanelField label="Nilai">{nilai}</RowPanelField>
              <RowPanelField label="Status">
                <StatusPill tone={eligibilityTone[entry.eligibility]}>
                  {eligibilityLabel[entry.eligibility]}
                </StatusPill>
              </RowPanelField>
            </RowPanelDetails>
            <DetailPanel detail={detail} />
          </div>
        ) : undefined
      }
    >
      <RowTitle>
        <Peringkat rank={entry.rank} />
        {entry.objectName}
      </RowTitle>
      <RowField kind="duration" icon={false} detail>
        {entry.unitName}
      </RowField>
      <RowField kind="location" icon={false} detail>
        {respons}
      </RowField>
      <RowField kind="topic" icon={false}>
        <span className="leaderboard-score">{nilai}</span>
      </RowField>
      <RowField kind="dates" icon={false}>
        <StatusPill tone={eligibilityTone[entry.eligibility]}>
          {eligibilityLabel[entry.eligibility]}
        </StatusPill>
      </RowField>
      {/* Tanpa detail tidak ada tombol buka-tutup; kolom Aksi tetap diisi supaya bidang lain
          tidak bergeser dari kepala kolomnya. */}
      {!bisaDibuka && <RowActions>{null}</RowActions>}
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
          <ul className="leaderboard-detail">
            {detail.respondents.map((r, i) => (
              <li key={i}>
                <span>
                  {r.evaluatorName}{" "}
                  <span className="leaderboard-detail__muted">({r.evaluatorLogin})</span>
                </span>
                <span className="leaderboard-detail__muted">
                  {r.scores.map((s) => `${s.parameterName}: ${s.score}`).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
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
}: {
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
      <label className="admin-tools__field">
        <span>Cari objek</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nama objek di kedua leaderboard…"
          className="form__control"
        />
      </label>

      <div>
        <h2 className="app-panel__label">Leaderboard Pimpinan</h2>
        <LeaderboardTable
          entries={pimpinanEntries}
          minimum={pimpinanMinimum}
          showDetail
          detailByObject={pimpinanDetail}
          searchTerm={search}
        />
      </div>
      <div>
        <h2 className="app-panel__label">Leaderboard Selain Pimpinan</h2>
        <LeaderboardTable
          entries={selainEntries}
          minimum={selainMinimum}
          showDetail
          detailByObject={selainDetail}
          searchTerm={search}
        />
      </div>
    </div>
  );
}
