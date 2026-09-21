import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/authz";
import { ambilProfil } from "@/lib/services/profil";
import { PageIntro } from "@/components/theme/summary";
import { ProfilForm } from "./profil-form";

export default async function ProfilPage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx) redirect("/login");

  const profil = await ambilProfil(ctx.userId);
  if (!profil) redirect("/login");

  const peran = ctx.isAdmin
    ? "Admin"
    : ctx.isDekan
      ? "Dekan"
      : ctx.leadershipUnitIds.length > 0
        ? "Pimpinan Unit"
        : "Pengguna";

  return (
    <div className="space-y-8">
      <PageIntro
        title="Profil"
        intro="Lengkapi nama dan nomor induk Anda. SSO tidak menyediakan keduanya secara lengkap, jadi hanya Anda yang dapat memastikannya benar."
      />

      <ProfilForm name={profil.name} loginIdentifier={profil.loginIdentifier} />

      {/* Bagian yang tidak diisi sendiri. Unit menentukan objek unit mana yang boleh Anda nilai,
          jadi ia ditetapkan admin — bukan dipilih sendiri. Email dan jenis pengguna datang dari
          SSO dan dipakai mencocokkan akun. */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Ditetapkan admin</h2>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Email UNDIP</dt>
            <dd className="mt-0.5">{profil.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Jenis pengguna</dt>
            <dd className="mt-0.5">{profil.userType.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Unit / Departemen</dt>
            <dd className="mt-0.5">
              {profil.primaryUnit ? (
                profil.primaryUnit.name
              ) : (
                <span className="text-[var(--muted)]">
                  Belum ditetapkan — hubungi admin agar Anda dapat menerima tugas penilaian.
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">Peran</dt>
            <dd className="mt-0.5">{peran}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
