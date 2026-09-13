"use client";

import { useAksi } from "@/components/theme/notifikasi";
import { reportIssueAction } from "@/lib/actions/assignmentIssues";

const typeOptions = [
  { value: "OBJEK_KELIRU", label: "Objek keliru" },
  { value: "UNIT_KELIRU", label: "Unit keliru" },
  { value: "PENGGUNA_NONAKTIF", label: "Pengguna nonaktif" },
  { value: "TAUTAN_KARYA_SALAH", label: "Tautan karya salah" },
  { value: "LAINNYA", label: "Lainnya" },
];

export function IssueReportForm({ assignmentId }: { assignmentId: string }) {
  const [state, formAction, pending] = useAksi(reportIssueAction, {}, "Laporan masalah terkirim.");

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <select
        name="type"
        required
        defaultValue=""
        className="form__control"
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
        className="form__control sm:col-span-2"
      />
      <div className="sm:col-span-3">
        <p className="mb-2 app-text-xs text-[var(--muted)]">
          Laporan bukan jawaban survei dan tidak membebaskan kewajiban mengisi sebelum admin
          bertindak.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="app-btn"
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
