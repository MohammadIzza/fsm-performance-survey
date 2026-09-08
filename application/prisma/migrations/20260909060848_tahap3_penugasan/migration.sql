-- CreateEnum
CREATE TYPE "AssignmentScope" AS ENUM ('UNIT_OBJEK', 'UNIT_DAN_SUBUNIT');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('BELUM_MULAI', 'DRAF', 'TERKIRIM', 'DIBUKA_KEMBALI', 'DIBATALKAN', 'LEWAT_TENGGAT');

-- CreateTable
CREATE TABLE "assignment_rules" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "group" "AssessmentGroup" NOT NULL,
    "scope" "AssignmentScope" NOT NULL DEFAULT 'UNIT_OBJEK',
    "user_type_ids" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_batches" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "rule_revision_snapshot" JSONB NOT NULL,
    "candidate_snapshot" JSONB NOT NULL,
    "seed" TEXT NOT NULL,
    "result_summary" JSONB NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "category_object_id" TEXT NOT NULL,
    "evaluator_id" TEXT NOT NULL,
    "group" "AssessmentGroup" NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'BELUM_MULAI',
    "reason" TEXT,
    "batch_id" TEXT,
    "replaces_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assignment_rules_category_id_group_key" ON "assignment_rules"("category_id", "group");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_replaces_id_key" ON "assignments"("replaces_id");

-- CreateIndex
CREATE INDEX "assignments_evaluator_id_idx" ON "assignments"("evaluator_id");

-- CreateIndex
CREATE INDEX "assignments_category_object_id_idx" ON "assignments"("category_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "assignments_category_object_id_evaluator_id_key" ON "assignments"("category_object_id", "evaluator_id");

-- AddForeignKey
ALTER TABLE "assignment_rules" ADD CONSTRAINT "assignment_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_batches" ADD CONSTRAINT "assignment_batches_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_batches" ADD CONSTRAINT "assignment_batches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_category_object_id_fkey" FOREIGN KEY ("category_object_id") REFERENCES "category_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "assignment_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_replaces_id_fkey" FOREIGN KEY ("replaces_id") REFERENCES "assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
