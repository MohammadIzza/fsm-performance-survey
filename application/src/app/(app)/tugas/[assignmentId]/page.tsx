import { notFound, redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/authz";
import { getAssignmentFormData, computeDisplayStatus } from "@/lib/services/responses";
import { ServiceError } from "@/lib/services/units";
import { AssignmentForm } from "./assignment-form";
import { AdminTools } from "./admin-tools";

const groupLabel: Record<string, string> = {
  PIMPINAN: "Pimpinan",
  SELAIN_PIMPINAN: "Selain Pimpinan",
};

const statusLabel: Record<string, string> = {
  BELUM_MULAI: "Belum mulai",
  DRAF: "Draf",
  TERKIRIM: "Terkirim",
  DIBUKA_KEMBALI: "Dibuka kembali",
  DIBATALKAN: "Dibatalkan",
  LEWAT_TENGGAT: "Lewat tenggat",
};

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AssignmentFormPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const ctx = await getCurrentAuthContext();
  if (!ctx) redirect("/login");

  let data;
  try {
    data = await getAssignmentFormData(assignmentId, ctx);
  } catch (e) {
    if (e instanceof ServiceError) notFound();
    throw e;
  }

  const { assignment, isOwner, editableRevision, effectiveRevision } = data;
  const category = assignment.categoryObject.category;
  const period = category.period;
  const displayStatus = computeDisplayStatus(assignment.status, period.status, period.endsAt);
  // Mencerminkan assertFillable() di lapisan service (sumber kebenaran, diperiksa ulang di
  // server saat submit): tugas dapat diisi bila belum terkirim/dibatalkan, dan — kecuali
  // sedang dalam jendela koreksi (DIBUKA_KEMBALI) — periode masih Aktif dan belum lewat tenggat.
  const statusAllowsEditing =
    assignment.status === "BELUM_MULAI" ||
    assignment.status === "DRAF" ||
    assignment.status === "DIBUKA_KEMBALI";
  const canEdit =
    isOwner &&
    statusAllowsEditing &&
    (assignment.status === "DIBUKA_KEMBALI" || displayStatus !== "LEWAT_TENGGAT");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[13px] text-[var(--muted)]">
          {period.name} · {category.name}
        </p>
        <h1 className="mt-1 page-title text-[24px] sm:text-[28px] text-[var(--foreground)]">
          {assignment.categoryObject.nameSnapshot}
        </h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          {assignment.categoryObject.unitSnapshot}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-[var(--muted)]">
          <span className="inline-flex rounded-full bg-black/5 px-2.5 py-1 font-medium">
            {groupLabel[assignment.group]}
          </span>
          <span className="inline-flex rounded-full bg-black/5 px-2.5 py-1 font-medium">
            {statusLabel[displayStatus]}
          </span>
          <span>Tenggat: {dateFmt.format(period.endsAt)}</span>
          {!isOwner && ctx.isAdmin && (
            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">
              Melihat sebagai Admin — penilai: {assignment.evaluator.name}
            </span>
          )}
        </div>
      </div>

      {assignment.status === "DIBUKA_KEMBALI" && (
        <div className="rounded-xl bg-amber-50 p-4 text-[13px] text-amber-900">
          Tugas ini sedang diperbaiki. Jawaban terkirim sebelumnya tetap berlaku sampai revisi
          baru dikirim.
        </div>
      )}
      {assignment.status === "DIBATALKAN" && (
        <div className="rounded-xl bg-black/5 p-4 text-[13px] text-[var(--muted)]">
          Tugas ini telah dibatalkan oleh admin.
        </div>
      )}
      {displayStatus === "LEWAT_TENGGAT" && (
        <div className="rounded-xl bg-[var(--danger)]/10 p-4 text-[13px] text-[var(--danger)]">
          Survei telah ditutup. Jawaban belum dikirim.
        </div>
      )}

      <AssignmentForm
        assignmentId={assignment.id}
        parameters={assignment.instrumentVersion.parameters}
        scale={{
          min: assignment.instrumentVersion.scaleMin,
          max: assignment.instrumentVersion.scaleMax,
          step: assignment.instrumentVersion.scaleStep,
        }}
        guide={assignment.instrumentVersion.guide}
        canEdit={canEdit}
        initialScores={
          (editableRevision ?? effectiveRevision)?.scores.reduce<Record<string, number>>(
            (acc, s) => {
              acc[s.parameterId] = s.score;
              return acc;
            },
            {}
          ) ?? {}
        }
        initialVersion={editableRevision?.version ?? null}
        isLocked={!canEdit}
        effectiveInfo={
          effectiveRevision
            ? {
                submittedAt: effectiveRevision.submittedAt
                  ? dateFmt.format(effectiveRevision.submittedAt)
                  : "—",
                revision: effectiveRevision.revision,
              }
            : null
        }
      />

      {ctx.isAdmin && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Alat Admin
          </h2>
          <AdminTools
            assignmentId={assignment.id}
            status={assignment.status}
            parameters={assignment.instrumentVersion.parameters}
            scale={{
              min: assignment.instrumentVersion.scaleMin,
              max: assignment.instrumentVersion.scaleMax,
              step: assignment.instrumentVersion.scaleStep,
            }}
            effectiveRevisionId={effectiveRevision?.id ?? null}
            effectiveScores={
              effectiveRevision?.scores.reduce<Record<string, number>>((acc, s) => {
                acc[s.parameterId] = s.score;
                return acc;
              }, {}) ?? {}
            }
          />
        </div>
      )}
    </div>
  );
}
