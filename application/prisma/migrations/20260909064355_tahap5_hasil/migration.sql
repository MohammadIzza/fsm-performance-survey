-- CreateEnum
CREATE TYPE "CalculationStatus" AS ENUM ('BERJALAN', 'BERHASIL', 'GAGAL');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('BELUM_ADA_PENILAIAN', 'BELUM_MEMENUHI_MINIMUM', 'MEMENUHI_SYARAT');

-- CreateTable
CREATE TABLE "calculation_runs" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "instrument_version_id" TEXT NOT NULL,
    "group_rule_snapshot" JSONB NOT NULL,
    "status" "CalculationStatus" NOT NULL DEFAULT 'BERJALAN',
    "triggered_by_id" TEXT NOT NULL,
    "error_message" TEXT,
    "completed_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_group_results" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "category_object_id" TEXT NOT NULL,
    "group" "AssessmentGroup" NOT NULL,
    "response_count" INTEGER NOT NULL,
    "score" DOUBLE PRECISION,
    "eligibility" "EligibilityStatus" NOT NULL,

    CONSTRAINT "object_group_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parameter_results" (
    "id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "parameter_id" TEXT NOT NULL,
    "aggregate" DOUBLE PRECISION NOT NULL,
    "contribution" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "parameter_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calculation_runs_category_id_idx" ON "calculation_runs"("category_id");

-- CreateIndex
CREATE INDEX "object_group_results_category_object_id_idx" ON "object_group_results"("category_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "object_group_results_run_id_category_object_id_group_key" ON "object_group_results"("run_id", "category_object_id", "group");

-- CreateIndex
CREATE UNIQUE INDEX "parameter_results_result_id_parameter_id_key" ON "parameter_results"("result_id", "parameter_id");

-- AddForeignKey
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_instrument_version_id_fkey" FOREIGN KEY ("instrument_version_id") REFERENCES "instrument_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_group_results" ADD CONSTRAINT "object_group_results_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "calculation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_group_results" ADD CONSTRAINT "object_group_results_category_object_id_fkey" FOREIGN KEY ("category_object_id") REFERENCES "category_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parameter_results" ADD CONSTRAINT "parameter_results_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "object_group_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parameter_results" ADD CONSTRAINT "parameter_results_parameter_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "parameters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

