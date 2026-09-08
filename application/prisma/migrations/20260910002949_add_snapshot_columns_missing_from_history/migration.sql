-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "correction_ends_at" TIMESTAMP(3),
ADD COLUMN     "evaluatorLoginSnapshot" TEXT,
ADD COLUMN     "evaluatorNameSnapshot" TEXT;

-- AlterTable
ALTER TABLE "calculation_runs" ADD COLUMN     "response_snapshot" JSONB;

-- AlterTable
ALTER TABLE "category_objects" ADD COLUMN     "owner_unit_id_snapshot" TEXT;

-- AlterTable
ALTER TABLE "periods" ADD COLUMN     "unit_tree_snapshot" JSONB;
