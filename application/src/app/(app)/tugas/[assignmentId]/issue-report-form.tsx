"use client";

import { useActionState } from "react";
import { reportIssueAction } from "@/lib/actions/assignmentIssues";

const typeOptions = [
  { value: "OBJEK_KELIRU", label: "Objek keliru" },
  { value: "UNIT_KELIRU", label: "Unit keliru" },
  { value: "PENGGUNA_NONAKTIF", label: "Pengguna nonaktif" },
  { value: "TAUTAN_KARYA_SALAH", label: "Tautan karya salah" },
  { value: "LAINNYA", label: "Lainnya" },
];

export function IssueReportForm({ assignmentId }: { assignmentId: string }) {
  const [state, formAction, pending] = useActionState(reportIssueAction, {});

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <select
        name="type"
        required
        defaultValue=""
        className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
      >
        <option value="" disabled>
          Kategori masalah…
        </option>
        {typeOptions.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <input
        name="detail"
        placeholder="Keterangan"
        required
        className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 sm:col-span-2"
      />
      <div className="sm:col-span-3">
        <p className="mb-2 text-[12px] text-[var(--muted)]">
          Laporan bukan jawaban survei dan tidak membebaskan kewajiban mengisi sebelum admin
          bertindak.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-[14px] font-medium text-[var(--foreground)] transition hover:bg-black/[0.03] disabled:opacity-60"
        >
          {pending ? "Mengirim…" : "Laporkan"}
        </button>
        {state.error && (
          <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
