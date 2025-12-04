import { getCurrentAuthContext } from "@/lib/authz";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getCurrentAuthContext();

  // Bab 4.1: pengelolaan master khusus Admin — Dekan dan pimpinan unit tidak diberi akses,
  // meski memiliki peran istimewa lain. Tampilkan status "tidak berwenang" secara eksplisit
  // (Bab 16.3), bukan redirect diam-diam.
  if (!ctx || !ctx.isAdmin) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
        <p className="text-[15px] font-medium text-[var(--foreground)]">Tidak berwenang</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Halaman ini khusus untuk Admin. Peran Anda saat ini tidak memiliki akses.
        </p>
      </div>
    );
  }

  return <div className="admin-area">{children}</div>;
}
