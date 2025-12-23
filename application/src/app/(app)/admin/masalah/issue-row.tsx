"use client";

import { useActionState, useState } from "react";
import { resolveIssueAction } from "@/lib/actions/assignmentIssues";
import type { listAllIssues } from "@/lib/services/assignmentIssues";
import { StatusPill } from "@/components/theme/status-pill";

type Issue = Awaited<ReturnType<typeof listAllIssues>>[number];

const statusLabel: Record<string, string> = {
  TERBUKA: "Terbuka",
  DITANGANI: "Ditangani",
  SELESAI: "Selesai",
};

const statusTone = {
  TERBUKA: "gagal",
  DITANGANI: "perhatian",
  SELESAI: "selesai",
} as const;

export function IssueRow({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(resolveIssueAction, {});

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <StatusPill tone={statusTone[issue.status as keyof typeof statusTone]}>
          {statusLabel[issue.status]}
        </StatusPill>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="btn-plain app-text-xs"
        >
          {open ? "Tutup" : "Tangani"}
        </button>
      </div>
      {issue.resolution && !open && (
        <p className="app-text-xs" style={{ color: "var(--color-text)" }}>Tanggapan: {issue.resolution}</p>
      )}
      {open && (
        <form action={formAction} className="app-stack app-note">
          <input type="hidden" name="issueId" value={issue.id} />
          <select
            name="status"
            defaultValue={issue.status === "TERBUKA" ? "DITANGANI" : issue.status}
            className="form__control"
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
            className="form__control"
          />
          <button
            type="submit"
            disabled={pending}
            className="app-btn app-btn--primary self-start"
          >
            {pending ? "Menyimpan…" : "Simpan"}
          </button>
          {state.error && (
            <p role="alert" className="app-text-xs" style={{ color: "var(--color-brand-1)" }}>
              {state.error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
