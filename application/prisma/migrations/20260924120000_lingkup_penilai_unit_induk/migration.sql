-- Lingkup calon penilai baru: unit objek beserta unit di atasnya.
ALTER TYPE "AssignmentScope" ADD VALUE IF NOT EXISTS 'UNIT_DAN_INDUK';
