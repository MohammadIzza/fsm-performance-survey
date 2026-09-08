-- CreateEnum
CREATE TYPE "ResponseState" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('OBJEK_KELIRU', 'UNIT_KELIRU', 'PENGGUNA_NONAKTIF', 'TAUTAN_KARYA_SALAH', 'LAINNYA');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('TERBUKA', 'DITANGANI', 'SELESAI');

-- CreateTable
CREATE TABLE "response_revisions" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "state" "ResponseState" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "edited_by_id" TEXT NOT NULL,
    "reason" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "voided_at" TIMESTAMP(3),
    "voided_reason" TEXT,
    "voided_by_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "response_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response_scores" (
    "id" TEXT NOT NULL,
    "response_revision_id" TEXT NOT NULL,
    "parameter_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "response_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_issues" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "type" "IssueType" NOT NULL,
    "detail" TEXT NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'TERBUKA',
    "resolution" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "response_revisions_assignment_id_revision_key" ON "response_revisions"("assignment_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "response_scores_response_revision_id_parameter_id_key" ON "response_scores"("response_revision_id", "parameter_id");

-- AddForeignKey
ALTER TABLE "response_revisions" ADD CONSTRAINT "response_revisions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_revisions" ADD CONSTRAINT "response_revisions_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_revisions" ADD CONSTRAINT "response_revisions_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_scores" ADD CONSTRAINT "response_scores_response_revision_id_fkey" FOREIGN KEY ("response_revision_id") REFERENCES "response_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_scores" ADD CONSTRAINT "response_scores_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "parameters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_issues" ADD CONSTRAINT "assignment_issues_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_issues" ADD CONSTRAINT "assignment_issues_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_issues" ADD CONSTRAINT "assignment_issues_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
