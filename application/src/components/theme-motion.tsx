"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

// power3.out — kurva yang dipakai animasi masuk tema.
const KURVA_MASUK = "cubic-bezier(0.215, 0.61, 0.355, 1)";

/**
 * Gerak masuk halaman aplikasi: isi utama naik sedikit sambil memudar masuk, judul halaman
 * menyusul. Memakai Web Animations API bawaan peramban, bukan GSAP — GSAP menambah ±27 KB
 * (terkompresi) ke setiap halaman aplikasi hanya untuk dua animasi sederhana ini. Tanpa `fill`,
 * gaya animasi lepas dengan sendirinya setelah selesai (setara `clearProps`).
 */
export function ThemeReveal() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animasi: Animation[] = [];
    // Halaman masuk tidak ikut: satu-satunya div langsung di <main>-nya adalah pita bukit, yang
    // ikut memudar dan bergeser sehingga tampil pucat sesaat — dan huruf FSM di sana punya gerak
    // masuknya sendiri.
    for (const el of document.querySelectorAll<HTMLElement>("main:not(.survey-login) > div")) {
      animasi.push(
        el.animate(
          [
            { transform: "translate3d(0, 24px, 0)", opacity: 0 },
            { transform: "none", opacity: 1 },
          ],
          { duration: 700, easing: KURVA_MASUK }
        )
      );
    }
    for (const el of document.querySelectorAll<HTMLElement>(".page-title")) {
      animasi.push(
        el.animate([{ transform: "translate3d(0, 18px, 0)" }, { transform: "none" }], {
          duration: 850,
          easing: KURVA_MASUK,
        })
      );
    }
    return () => {
      for (const a of animasi) a.cancel();
    };
  }, [pathname]);
  return null;
}
