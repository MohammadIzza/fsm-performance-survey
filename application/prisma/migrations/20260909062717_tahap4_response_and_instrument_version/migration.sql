-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "instrument_version_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "response_revisions" ADD COLUMN     "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "response_revisions_idempotency_key_key" ON "response_revisions"("idempotency_key");

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_instrument_version_id_fkey" FOREIGN KEY ("instrument_version_id") REFERENCES "instrument_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

