"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

interface NavLink {
  href: string;
  label: string;
}

// Sidebar tetap di kiri untuk desktop (≥lg) — pola navigasi khas aplikasi kerja (mis. dashboard
// admin), lebih mudah dipindai daripada navbar horizontal karena semua tautan langsung terlihat
// tanpa dropdown. Di mobile, sidebar jadi drawer yang digeser masuk dari kiri lewat tombol
// hamburger di top bar ringkas.
export function SidebarNav({
  mainLinks,
  adminLinks,
  userName,
  roleLabel,
  initial,
  logoutSlot,
}: {
  mainLinks: NavLink[];
  adminLinks: NavLink[];
  userName: string;
  roleLabel: string;
  initial: string;
  logoutSlot: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Menutup drawer saat berpindah halaman, mengikuti pola resmi React "menyimpan info dari
  // render sebelumnya" (https://react.dev/reference/react/useState#storing-information-from-previous-renders) —
  // disesuaikan langsung di badan render, bukan lewat effect terpisah atau ref.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  // Kunci scroll halaman di belakang drawer selagi terbuka.
  useEffect(() => {
    if (!mobileOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const linkClass = (href: string) =>
    `rounded-lg px-3 py-2.5 text-[14px] font-medium transition lg:py-2 ${
      isActive(href)
        ? "bg-[var(--accent-tint)] text-[var(--accent)]"
        : "text-[var(--muted)] hover:bg-black/[0.03] hover:text-[var(--foreground)]"
    }`;

  const navContent = (
    <>
      <Link href="/dashboard" className="flex shrink-0 items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-[12px] font-semibold text-white">
          FSM
        </div>
        <span className="text-[15px] font-medium text-[var(--foreground)]">Survei Penilaian</span>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="flex flex-col gap-0.5">
          {mainLinks.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(l.href)}>
              {l.label}
            </Link>
          ))}
        </div>
        {adminLinks.length > 0 && (
          <div className="mt-5">
            <p className="eyebrow mb-1.5 px-3">Admin</p>
            <div className="flex flex-col gap-0.5">
              {adminLinks.map((l) => (
                <Link key={l.href} href={l.href} className={linkClass(l.href)}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
      <div className="shrink-0 border-t border-[var(--border)] p-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-tint)] text-[13px] font-semibold text-[var(--accent)]"
            aria-hidden="true"
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-medium text-[var(--foreground)]">{userName}</p>
            <p className="text-[11px] text-[var(--muted)]">{roleLabel}</p>
          </div>
        </div>
        {logoutSlot}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop (≥lg): sidebar permanen, tinggi penuh layar, sticky di kiri. */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] lg:flex">
        {navContent}
      </aside>

      {/* Mobile (<lg): top bar ringkas + hamburger yang membuka drawer. */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-[11px] font-semibold text-white">
            FSM
          </div>
          <span className="text-[15px] font-medium text-[var(--foreground)]">Survei Penilaian</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-sidebar-panel"
          aria-label="Buka menu"
          className="tap-target flex h-8 w-8 items-center justify-center rounded-lg text-[var(--foreground)] transition hover:bg-black/[0.04]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M2.5 5H15.5M2.5 9H15.5M2.5 13H15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <div
            id="mobile-sidebar-panel"
            role="dialog"
            aria-modal="true"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[var(--surface)] shadow-xl"
          >
            <div className="flex shrink-0 items-center justify-end px-3 pt-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Tutup menu"
                className="tap-target flex h-8 w-8 items-center justify-center rounded-lg text-[var(--foreground)] transition hover:bg-black/[0.04]"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
