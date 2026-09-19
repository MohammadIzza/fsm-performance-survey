-- AlterTable
ALTER TABLE "users" ADD COLUMN     "sso_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_sso_id_key" ON "users"("sso_id");
