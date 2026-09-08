"use client";

import { useState } from "react";
import type { RankedEntry } from "@/lib/services/rankings";

export interface DetailData {
  parameterResults: { parameterName: string; aggregate: number; contribution: number; weight: number }[];
  respondents: { evaluatorName: string; evaluatorLogin: string; submittedAt: string | null; scores: { parameterName: string; score: number }[] }[];
}

const eligibilityLabel: Record<RankedEntry["eligibility"], string> = {
  BELUM_ADA_PENILAIAN: "Belum ada penilaian",
  BELUM_MEMENUHI_MINIMUM: "Belum memenuhi minimum",
  MEMENUHI_SYARAT: "Memenuhi syarat",
};

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
    return <p className="text-[13px] text-[var(--muted)]">Belum ada penilaian.</p>;
  }

  const term = searchTerm?.trim().toLowerCase();
  const visible = term
    ? entries.filter((e) => e.objectName.toLowerCase().includes(term))
    : entries;

  if (visible.length === 0) {
    return (
      <p className="text-[13px] text-[var(--muted)]">
        Tidak ada objek yang cocok dengan &ldquo;{searchTerm}&rdquo; pada lingkup ini.
      </p>
    );
  }

  return (
    <>
      {/* Mobile (<md): kartu bertumpuk — peringkat & nilai jadi fokus visual utama, tanpa
          perlu menggulung tabel menyamping untuk membaca kolom. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {visible.map((e) => (
          <EntryCard
            key={e.categoryObjectId}
            entry={e}
            minimum={minimum}
            showDetail={showDetail}
            detail={detailByObject?.get(e.categoryObjectId)}
          />
        ))}
      </ul>

      {/* Desktop (≥md): tabel padat. */}
      <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)] md:block">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <th className="px-3 py-2 font-medium">Peringkat</th>
              <th className="px-3 py-2 font-medium">Objek</th>
              <th className="px-3 py-2 font-medium">Unit</th>
              <th className="px-3 py-2 font-medium">Respons</th>
              <th className="px-3 py-2 font-medium">Nilai</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <EntryRow
                key={e.categoryObjectId}
                entry={e}
                minimum={minimum}
                showDetail={showDetail}
                detail={detailByObject?.get(e.categoryObjectId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Lencana peringkat: 1–3 diberi aksen warna, sisanya penomoran netral seperti sebelumnya —
    leaderboard tetap terasa seperti papan peringkat tanpa mengubah kolom apa pun. */
function RankBadge({ rank }: { rank: number | null }) {
  const medal =
    rank === 1
      ? "bg-[var(--warm-tint)] text-[var(--warm)]"
      : rank === 2
        ? "bg-black/[0.06] text-[var(--foreground)]"
        : rank === 3
          ? "bg-[var(--accent-tint)] text-[var(--accent)]"
          : "bg-black/[0.04] text-[var(--foreground)]";
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold ${medal}`}
    >
      {rank ?? "—"}
    </span>
  );
}

function DetailPanel({ detail }: { detail: DetailData }) {
  return (
    <div className="space-y-3">
      {detail.parameterResults.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Agregasi per parameter
          </p>
          <ul className="space-y-1">
            {detail.parameterResults.map((p) => (
              <li key={p.parameterName} className="flex items-baseline justify-between text-[12px]">
                <span className="text-[var(--foreground)]">
                  {p.parameterName} <span className="text-[var(--muted)]">({p.weight}%)</span>
                </span>
                <span className="text-[var(--muted)]">
                  {p.aggregate.toFixed(2)} → {p.contribution.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Penilai yang berkontribusi
        </p>
        {detail.respondents.length === 0 ? (
          <p className="text-[12px] text-[var(--muted)]">Belum ada jawaban terkirim.</p>
        ) : (
          <ul className="space-y-1.5">
            {detail.respondents.map((r, i) => (
              <li key={i} className="text-[12px]">
                <span className="font-medium text-[var(--foreground)]">{r.evaluatorName}</span>{" "}
                <span className="font-mono text-[11px] text-[var(--muted)]">({r.evaluatorLogin})</span>
                <span className="ml-2 text-[var(--muted)]">
                  {r.scores.map((s) => `${s.parameterName}: ${s.score}`).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EntryCard({
  entry,
  minimum,
  showDetail,
  detail,
}: {
  entry: RankedEntry;
  minimum: number;
  showDetail: boolean;
  detail?: DetailData;
}) {
  const [open, setOpen] = useState(false);
  const canExpand = showDetail && !!detail;

  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={canExpand ? () => setOpen((v) => !v) : undefined}
        disabled={!canExpand}
        className="flex w-full items-center gap-3 p-3 text-left disabled:cursor-default"
      >
        <RankBadge rank={entry.rank} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-[var(--foreground)]">
            {entry.objectName}
          </span>
          <span className="block truncate text-[12px] text-[var(--muted)]">{entry.unitName}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[16px] font-semibold text-[var(--foreground)]">
            {entry.score !== null ? entry.score.toFixed(2) : "—"}
          </span>
          <span className="block text-[11px] text-[var(--muted)]">
            {entry.responseCount} resp.{entry.eligibility !== "MEMENUHI_SYARAT" && ` / min. ${minimum}`}
          </span>
        </span>
        {canExpand && (
          <span className="shrink-0 text-[11px] text-[var(--accent)]" aria-hidden="true">
            {open ? "▲" : "▼"}
          </span>
        )}
      </button>
      {entry.eligibility !== "MEMENUHI_SYARAT" && (
        <p className="px-3 pb-2 text-[11px] text-[var(--warm)]">{eligibilityLabel[entry.eligibility]}</p>
      )}
      {open && detail && (
        <div className="border-t border-[var(--border)] bg-black/[0.015] p-3">
          <DetailPanel detail={detail} />
        </div>
      )}
    </li>
  );
}

function EntryRow({
  entry,
  minimum,
  showDetail,
  detail,
}: {
  entry: RankedEntry;
  minimum: number;
  showDetail: boolean;
  detail?: DetailData;
}) {
  const [open, setOpen] = useState(false);
  const canExpand = showDetail && !!detail;

  return (
    <>
      <tr
        className={`border-b border-[var(--border)] last:border-b-0 ${canExpand ? "cursor-pointer hover:bg-black/[0.015]" : ""}`}
        onClick={canExpand ? () => setOpen((v) => !v) : undefined}
      >
        <td className="px-3 py-2">
          <RankBadge rank={entry.rank} />
        </td>
        <td className="px-3 py-2 font-medium text-[var(--foreground)]">
          {entry.objectName}
          {canExpand && (
            <span className="ml-1.5 text-[11px] text-[var(--accent)]">{open ? "▲" : "▼"}</span>
          )}
        </td>
        <td className="px-3 py-2 text-[var(--muted)]">{entry.unitName}</td>
        <td className="px-3 py-2 text-[var(--muted)]">
          {entry.responseCount} {entry.eligibility !== "MEMENUHI_SYARAT" && `/ min. ${minimum}`}
        </td>
        <td className="px-3 py-2 text-[var(--foreground)]">
          {entry.score !== null ? entry.score.toFixed(2) : "—"}
        </td>
        <td className="px-3 py-2 text-[var(--muted)]">{eligibilityLabel[entry.eligibility]}</td>
      </tr>
      {open && detail && (
        <tr className="border-b border-[var(--border)] bg-black/[0.015] last:border-b-0">
          <td colSpan={6} className="px-3 py-3">
            <DetailPanel detail={detail} />
          </td>
        </tr>
      )}
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

  return (
    <div className="grid gap-6">
      <div className="relative">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama objek di kedua leaderboard…"
          aria-label="Cari nama objek di leaderboard"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[14px] text-[var(--foreground)] shadow-sm placeholder:text-[var(--muted)]"
        />
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Leaderboard Pimpinan
        </h2>
        <LeaderboardTable
          entries={pimpinanEntries}
          minimum={pimpinanMinimum}
          showDetail
          detailByObject={pimpinanDetail}
          searchTerm={search}
        />
      </div>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Leaderboard Selain Pimpinan
        </h2>
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
