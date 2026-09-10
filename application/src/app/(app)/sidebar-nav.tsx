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
//
// Tautannya memakai markah menu tema (.site-head__menu > .menu-item > .menu-link >
// .menu-item__text), jadi huruf, jarak, warna keadaan aktif, dan transisinya sama persis dengan
// menu situs publik. Yang disetel ulang hanya arahnya — menu tema disusun mendatar, sidebar ini
// menurun — lewat .site-head__menu--stack di globals.css.
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

  const menu = (links: NavLink[]) => (
    <ul className="site-head__menu site-head__menu--stack">
      {links.map((l) => (
        <li key={l.href} className={`menu-item${isActive(l.href) ? " current-menu-item" : ""}`}>
          <Link
            href={l.href}
            className="menu-link"
            aria-current={isActive(l.href) ? "page" : undefined}
          >
            <span className="menu-item__text" data-text={l.label}>
              {l.label}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );

  const navContent = (
    <>
      {/* Lambang yang sama dengan kepala situs publik. Nama fakultasnya tidak diulang di sini —
          kepala situs di atas sudah memuatnya, dan di lebar sidebar teks itu membungkus empat
          baris. */}
      <div className="s__logo survey-side__logo">
        <Link href="/dashboard">
          <img
            src="/assets/images/hero-home-undip.svg"
            alt="Survei Penilaian FSM UNDIP"
            width="120"
            height="26"
          />
        </Link>
      </div>

      <nav className="survey-side__nav">
        {menu(mainLinks)}
        {adminLinks.length > 0 && (
          <>
            <p className="eyebrow survey-side__section">Admin</p>
            {menu(adminLinks)}
          </>
        )}
      </nav>

      <div className="survey-side__foot">
        <div className="survey-side__user">
          <span className="survey-side__avatar" aria-hidden="true">
            {initial}
          </span>
          <span className="survey-side__who">
            <span className="survey-side__name">{userName}</span>
            <span className="survey-side__role">{roleLabel}</span>
          </span>
        </div>
        {logoutSlot}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop (≥lg): sidebar permanen, tinggi penuh layar, sticky di kiri. */}
      <aside className="survey-side sticky top-0 hidden h-screen w-56 shrink-0 flex-col lg:flex">
        {navContent}
      </aside>

      {/* Mobile (<lg): top bar ringkas + hamburger yang membuka drawer. Tombolnya memakai bentuk
          dan warna tombol menu tema (.s__toggle): bulat, brand-5, dua garis. */}
      <div className="survey-side__bar lg:hidden">
        <Link href="/dashboard" className="survey-side__bar-brand">
          <img
            src="/assets/images/hero-home-undip.svg"
            alt="Survei Penilaian FSM UNDIP"
            width="96"
            height="21"
          />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-sidebar-panel"
          aria-label="Buka menu"
          className="s__toggle survey-side__toggle"
        >
          <span className="s__toggle__lines">
            <span className="s__toggle__line" />
            <span className="s__toggle__line" />
          </span>
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
            className="survey-side survey-side--drawer absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Tutup menu"
              className="s__toggle survey-side__toggle survey-side__close is-opened"
            >
              <span className="s__toggle__lines">
                <span className="s__toggle__line" />
                <span className="s__toggle__line" />
              </span>
            </button>
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
