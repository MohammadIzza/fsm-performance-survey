-- Nilai mentah yang dinormalisasi per parameter, agregat mentahnya di hasil, dan bobot nilai
-- gabungan antar-kelompok per kategori. Ketiganya opsional: data lama tetap berlaku apa adanya
-- (parameter tidak dinormalisasi, kategori tanpa nilai gabungan).

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "pimpinan_weight" INTEGER;

-- AlterTable
ALTER TABLE "parameter_results" ADD COLUMN     "raw_aggregate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "parameters" ADD COLUMN     "normalized" BOOLEAN NOT NULL DEFAULT false;
