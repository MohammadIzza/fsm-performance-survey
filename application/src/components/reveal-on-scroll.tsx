"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Pengganti satu-satunya bagian runtime Luge yang benar-benar dibutuhkan.
 *
 * `base.css` menyetel `[data-lg-reveal] { opacity: 0 }`, dan yang membatalkannya adalah kelas
 * `.is-in` — di situs publik dipasang oleh Luge saat elemen masuk layar. Tanpa itu isi halaman
 * tidak pernah terlihat: halaman referensi yang dimuat tanpa JavaScript memang tampil kosong.
 *
 * Luge utuh tidak dipakai karena ia juga mengambil alih pengguliran dan transisi antar halaman,
 * yang bentrok dengan perpindahan halaman sisi klien Next.js. Yang perlu ditiru cuma pemasang
 * kelasnya, dan itu muat dalam satu IntersectionObserver.
 *
 * Dijalankan ulang tiap pindah halaman: setelah navigasi sisi klien, elemen ber-`data-lg-reveal`
 * yang baru belum pernah diamati siapa pun.
 */
export function RevealOnScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-lg-reveal]:not(.is-in)")
    );
    if (targets.length === 0) return;

    // Hormati preferensi sistem: kalau gerak dikurangi, isi langsung ditampilkan tanpa transisi
    // masuk sama sekali — bukan dianimasikan lebih cepat.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const el of targets) el.classList.add("is-in");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          // Sekali muncul, selesai — tidak disembunyikan lagi saat digulir keluar layar.
          observer.unobserve(entry.target);
        }
      },
      // Ambang kecil + margin bawah negatif: elemen mulai muncul sesaat sebelum benar-benar
      // sampai di tepi layar, sehingga tidak terasa "telat" seperti kalau menunggu 0px pas.
      { threshold: 0.05, rootMargin: "0px 0px -40px 0px" }
    );

    for (const el of targets) observer.observe(el);
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
