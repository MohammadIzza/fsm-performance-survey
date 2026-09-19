-- Kelompok objek bernama: pintasan memilih peserta kategori, tanpa pengaruh ke perhitungan.

-- CreateTable
CREATE TABLE "object_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "object_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "object_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "object_groups_name_key" ON "object_groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "object_group_members_group_id_object_id_key" ON "object_group_members"("group_id", "object_id");

-- AddForeignKey
ALTER TABLE "object_group_members" ADD CONSTRAINT "object_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "object_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_group_members" ADD CONSTRAINT "object_group_members_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "assessment_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

