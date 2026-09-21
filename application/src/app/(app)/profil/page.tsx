import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/authz";
import { ambilProfil } from "@/lib/services/profil";
import { PageIntro } from "@/components/theme/summary";
import { Panel } from "@/components/theme/panel";
import { RowPanelDetails, RowPanelField } from "@/components/theme/data-list";
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
      {/* Tanpa kartu ringkasan: kartu itu dirancang untuk angka, dan jenis pengguna maupun unit
          sudah tercantum utuh di bagian "Penempatan dan akun" di bawah. */}
      <PageIntro title="Profil" intro="Data diri Anda di ruang penilaian." />

      <Panel
        plain
        eyebrow="Diisi sendiri"
        title="Identitas"
        intro="Pastikan nama dan nomor induk Anda tertulis benar. Keduanya dipakai pada daftar penilai dan laporan hasil."
      >
        <ProfilForm name={profil.name} loginIdentifier={profil.loginIdentifier} />
      </Panel>

      {/* Unit menentukan objek unit mana yang boleh dinilai seseorang, jadi ia tidak dapat dipilih
          sendiri. Email dan jenis pengguna mengikuti akun UNDIP. */}
      <Panel
        eyebrow="Ditetapkan admin"
        title="Penempatan dan akun"
        intro="Bagian ini mengikuti data kepegawaian dan akun UNDIP Anda. Hubungi admin bila ada yang keliru."
      >
        <RowPanelDetails>
          <RowPanelField label="Email UNDIP">{profil.email ?? "—"}</RowPanelField>
          <RowPanelField label="Jenis pengguna">{profil.userType.name}</RowPanelField>
          <RowPanelField label="Unit / Departemen">
            {profil.primaryUnit ? profil.primaryUnit.name : "Belum ditetapkan"}
          </RowPanelField>
          <RowPanelField label="Peran">{peran}</RowPanelField>
        </RowPanelDetails>
      </Panel>
    </div>
  );
}
