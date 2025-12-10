import { notFound, redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/authz";
import { getAssignmentFormData, computeDisplayStatus } from "@/lib/services/responses";
import { ServiceError } from "@/lib/services/units";
import { AssignmentForm } from "./assignment-form";
import { AdminTools } from "./admin-tools";
import { PageIntro, SummaryCard } from "@/components/theme/summary";

const statusLabel: Record<string, string> = {
  BELUM_MULAI: "Belum mulai",
  DRAF: "Draf",
  TERKIRIM: "Terkirim",
  DIBUKA_KEMBALI: "Dibuka kembali",
  DIBATALKAN: "Dibatalkan",
  LEWAT_TENGGAT: "Lewat tenggat",
};

const statusTone: Record<string, "kuning" | "biru" | "tosca" | "merah"> = {
  BELUM_MULAI: "biru",
  DRAF: "biru",
  TERKIRIM: "tosca",
  DIBUKA_KEMBALI: "kuning",
  DIBATALKAN: "merah",
  LEWAT_TENGGAT: "merah",
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
    <div className="assignment-detail space-y-8">
      <PageIntro
        title={assignment.categoryObject.nameSnapshot}
        intro={assignment.categoryObject.unitSnapshot}
      >
        <SummaryCard tone="kuning" label="Periode" value={period.name} />
        <SummaryCard tone="biru" label="Kategori" value={category.name} />
        <SummaryCard
          tone={statusTone[displayStatus]}
          label="Status"
          value={statusLabel[displayStatus]}
          note={`Tenggat ${dateFmt.format(period.endsAt)}`}
        />
      </PageIntro>

      {!isOwner && ctx.isAdmin && (
        <div className="assignment-detail__notice rounded-xl bg-amber-50 p-4 text-[13px] text-amber-900">
          Melihat sebagai Admin — penilai: {assignment.evaluator.name}
        </div>
      )}

      {assignment.status === "DIBUKA_KEMBALI" && (
        <div className="assignment-detail__notice rounded-xl bg-amber-50 p-4 text-[13px] text-amber-900">
          Tugas ini sedang diperbaiki. Jawaban terkirim sebelumnya tetap berlaku sampai revisi
          baru dikirim.
        </div>
      )}
      {assignment.status === "DIBATALKAN" && (
        <div className="assignment-detail__notice rounded-xl bg-black/5 p-4 text-[13px] text-[var(--muted)]">
          Tugas ini telah dibatalkan oleh admin.
        </div>
      )}
      {displayStatus === "LEWAT_TENGGAT" && (
        <div className="assignment-detail__notice rounded-xl bg-[var(--danger)]/10 p-4 text-[13px] text-[var(--danger)]">
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
