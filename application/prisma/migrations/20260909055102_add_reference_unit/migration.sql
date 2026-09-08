-- AlterTable
ALTER TABLE "assessment_objects" ADD COLUMN     "reference_unit_id" TEXT;

-- AddForeignKey
ALTER TABLE "assessment_objects" ADD CONSTRAINT "assessment_objects_reference_unit_id_fkey" FOREIGN KEY ("reference_unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
