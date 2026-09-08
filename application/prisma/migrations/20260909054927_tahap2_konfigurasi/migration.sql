-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('DRAF', 'SIAP', 'AKTIF', 'DITUTUP', 'FINAL', 'REVISI');

-- CreateEnum
CREATE TYPE "AccessMode" AS ENUM ('SELAMA_AKTIF', 'SETELAH_DITUTUP', 'SETELAH_FINAL', 'WAKTU_TERTENTU');

-- CreateEnum
CREATE TYPE "AssessmentGroup" AS ENUM ('PIMPINAN', 'SELAIN_PIMPINAN');

-- CreateEnum
CREATE TYPE "AggregationMethod" AS ENUM ('RATA_RATA', 'TOTAL');

-- CreateTable
CREATE TABLE "periods" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'DRAF',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" TEXT NOT NULL,
    "finalized_at" TIMESTAMP(3),
    "copied_from_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_policies" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "mode" "AccessMode" NOT NULL DEFAULT 'SETELAH_FINAL',
    "available_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "changed_by_id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "object_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_objects" (
    "id" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "reference_user_id" TEXT,
    "name" TEXT NOT NULL,
    "owner_unit_id" TEXT NOT NULL,
    "responsible_user_id" TEXT,
    "url" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_contributors" (
    "id" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "object_contributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "object_type_id" TEXT NOT NULL,
    "exclude_contributors" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_objects" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "unit_snapshot" TEXT NOT NULL,
    "name_snapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instrument_versions" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "scale_min" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scale_max" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "scale_step" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "guide" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instrument_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parameters" (
    "id" TEXT NOT NULL,
    "instrument_version_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "indicator" TEXT,
    "weight" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_rules" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "group" "AssessmentGroup" NOT NULL,
    "aggregation" "AggregationMethod" NOT NULL DEFAULT 'RATA_RATA',
    "target" INTEGER NOT NULL DEFAULT 10,
    "minimum" INTEGER NOT NULL DEFAULT 1,
    "tie_break_parameter_ids" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "periods_code_key" ON "periods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "access_policies_period_id_key" ON "access_policies"("period_id");

-- CreateIndex
CREATE UNIQUE INDEX "object_types_code_key" ON "object_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "object_contributors_object_id_user_id_key" ON "object_contributors"("object_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_period_id_code_key" ON "categories"("period_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "category_objects_category_id_object_id_key" ON "category_objects"("category_id", "object_id");

-- CreateIndex
CREATE UNIQUE INDEX "instrument_versions_category_id_revision_key" ON "instrument_versions"("category_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "group_rules_category_id_group_key" ON "group_rules"("category_id", "group");

-- AddForeignKey
ALTER TABLE "periods" ADD CONSTRAINT "periods_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periods" ADD CONSTRAINT "periods_copied_from_id_fkey" FOREIGN KEY ("copied_from_id") REFERENCES "periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_objects" ADD CONSTRAINT "assessment_objects_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "object_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_objects" ADD CONSTRAINT "assessment_objects_reference_user_id_fkey" FOREIGN KEY ("reference_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_objects" ADD CONSTRAINT "assessment_objects_owner_unit_id_fkey" FOREIGN KEY ("owner_unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_objects" ADD CONSTRAINT "assessment_objects_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_contributors" ADD CONSTRAINT "object_contributors_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "assessment_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_contributors" ADD CONSTRAINT "object_contributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_object_type_id_fkey" FOREIGN KEY ("object_type_id") REFERENCES "object_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_objects" ADD CONSTRAINT "category_objects_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_objects" ADD CONSTRAINT "category_objects_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "assessment_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instrument_versions" ADD CONSTRAINT "instrument_versions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parameters" ADD CONSTRAINT "parameters_instrument_version_id_fkey" FOREIGN KEY ("instrument_version_id") REFERENCES "instrument_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_rules" ADD CONSTRAINT "group_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
