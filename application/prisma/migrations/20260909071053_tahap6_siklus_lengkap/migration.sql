-- CreateEnum
CREATE TYPE "ImportEntity" AS ENUM ('UNIT', 'PENGGUNA', 'PIMPINAN');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('PREVIEW', 'DITERAPKAN', 'GAGAL');

-- AlterTable
ALTER TABLE "calculation_runs" ADD COLUMN     "finalization_id" TEXT;

-- CreateTable
CREATE TABLE "finalizations" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "finalized_by_id" TEXT NOT NULL,
    "finalized_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "prior_final_id" TEXT,

    CONSTRAINT "finalizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "entity" "ImportEntity" NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PREVIEW',
    "row_errors" JSONB,
    "summary" JSONB,
    "applied_by_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finalizations_prior_final_id_key" ON "finalizations"("prior_final_id");

-- CreateIndex
CREATE UNIQUE INDEX "finalizations_period_id_revision_key" ON "finalizations"("period_id", "revision");

-- AddForeignKey
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_finalization_id_fkey" FOREIGN KEY ("finalization_id") REFERENCES "finalizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finalizations" ADD CONSTRAINT "finalizations_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finalizations" ADD CONSTRAINT "finalizations_finalized_by_id_fkey" FOREIGN KEY ("finalized_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finalizations" ADD CONSTRAINT "finalizations_prior_final_id_fkey" FOREIGN KEY ("prior_final_id") REFERENCES "finalizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_applied_by_id_fkey" FOREIGN KEY ("applied_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

