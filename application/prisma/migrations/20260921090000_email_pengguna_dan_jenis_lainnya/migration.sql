-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Jenis pengguna untuk identitas SSO yang domain emailnya di luar students/lecturer/staff — di SSO
-- role-nya "unknown" (17 dari 862 akun). Mereka tetap boleh masuk sebagai pengguna biasa, jadi
-- perlu satu jenis yang jujur alih-alih dimasukkan ke Dosen atau Tenaga Kependidikan.
INSERT INTO "user_types" ("id", "code", "name", "active", "createdAt", "updatedAt")
VALUES ('usertype-lainnya', 'LAINNYA', 'Lainnya', true, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;
