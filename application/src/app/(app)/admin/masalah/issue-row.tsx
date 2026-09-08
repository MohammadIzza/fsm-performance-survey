"use client";

import { useActionState, useState } from "react";
import { resolveIssueAction } from "@/lib/actions/assignmentIssues";
import type { listAllIssues } from "@/lib/services/assignmentIssues";

type Issue = Awaited<ReturnType<typeof listAllIssues>>[number];

const statusLabel: Record<string, string> = {
  TERBUKA: "Terbuka",
  DITANGANI: "Ditangani",
  SELESAI: "Selesai",
};

const statusClass: Record<string, string> = {
  TERBUKA: "bg-[var(--danger)]/10 text-[var(--danger)]",
  DITANGANI: "bg-amber-500/10 text-amber-600",
  SELESAI: "bg-[var(--success)]/10 text-[var(--success)]",
};

export function IssueRow({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(resolveIssueAction, {});

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium ${statusClass[issue.status]}`}
        >
          {statusLabel[issue.status]}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[12px] font-medium text-[var(--accent)] hover:underline"
        >
          {open ? "Tutup" : "Tangani"}
        </button>
      </div>
      {issue.resolution && !open && (
        <p className="text-[12px] text-[var(--muted)]">Tanggapan: {issue.resolution}</p>
      )}
      {open && (
        <form action={formAction} className="flex flex-col gap-2 rounded-lg bg-black/[0.02] p-2.5">
          <input type="hidden" name="issueId" value={issue.id} />
          <select
            name="status"
            defaultValue={issue.status === "TERBUKA" ? "DITANGANI" : issue.status}
            className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-[12px] outline-none focus:border-[var(--accent)]"
          >
            <option value="TERBUKA">Terbuka</option>
            <option value="DITANGANI">Ditangani</option>
            <option value="SELESAI">Selesai</option>
          </select>
          <textarea
            name="resolution"
            placeholder="Tanggapan / tindakan yang diambil"
            defaultValue={issue.resolution ?? ""}
            rows={2}
            className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-[12px] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-lg bg-[var(--accent)] px-3 py-1 text-[12px] font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {pending ? "Menyimpan…" : "Simpan"}
          </button>
          {state.error && <p className="text-[12px] text-[var(--danger)]">{state.error}</p>}
        </form>
      )}
    </div>
  );
}
