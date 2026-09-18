import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAuthContext } from "@/lib/authz";
import { logoutAction } from "@/lib/actions/auth";
import { SidebarNav } from "./sidebar-nav";
import { NotifikasiProvider } from "@/components/theme/notifikasi";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const ctx = await getAuthContext(session.userId);
  if (!ctx || !ctx.active) {
    redirect("/login");
  }

  const roleLabel = ctx.isAdmin
    ? "Admin"
    : ctx.isDekan
      ? "Dekan"
      : ctx.leadershipUnitIds.length > 0
        ? "Pimpinan Unit"
        : "Pengguna";

  const mainLinks = [
    { href: "/dashboard", label: "Beranda" },
    { href: "/tugas", label: "Tugas Saya" },
    ...(ctx.isAdmin || ctx.isDekan ? [{href:"/akses-hasil",label:"Waktu akses hasil"}] : []),
    ...(ctx.isAdmin || ctx.isDekan || ctx.leadershipUnitIds.length > 0
      ? [{ href: "/hasil", label: "Hasil" }]
      : []),
  ];
  const adminLinks = ctx.isAdmin
    ? [
        { href: "/admin/organisasi", label: "Organisasi" },
        { href: "/admin/pengguna", label: "Pengguna" },
        { href: "/admin/objek", label: "Objek" },
        { href: "/admin/periode", label: "Periode" },
        { href: "/admin/pemantauan", label: "Pemantauan" },
        { href: "/admin/audit", label: "Audit" },
        { href: "/admin/impor", label: "Impor" },
      ]
    : [];

  const initial = ctx.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <NotifikasiProvider>
    <div className="survey-shell min-h-screen lg:flex">
      <SidebarNav
        mainLinks={mainLinks}
        adminLinks={adminLinks}
        userName={ctx.name}
        roleLabel={roleLabel}
        initial={initial}
        logoutSlot={
          <form action={logoutAction} className="mt-1">
            <button
              type="submit"
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 app-text-sm font-medium text-[var(--foreground)] transition hover:bg-black/[0.03]"
            >
              Keluar
            </button>
          </form>
        }
      />
      <div className="flex min-h-screen flex-1 flex-col lg:min-w-0">
        <div className="border-b border-[var(--warm)]/25 bg-[var(--warm-tint)] px-4 py-2 text-center app-text-xs text-[var(--warm)] sm:px-6">
          <b>V2 — salinan uji coba.</b> Perubahan di sini tidak menyentuh aplikasi yang dipakai
          FSM. Data dan login bersifat fiktif (data dummy), bukan sistem produksi.
        </div>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-10 sm:px-6 sm:pt-6">{children}</main>
      </div>
    </div>
    </NotifikasiProvider>
  );
}
