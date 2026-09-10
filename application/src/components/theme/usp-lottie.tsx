"use client";

import { useEffect, useRef } from "react";

/**
 * Slot ilustrasi kartu. Halaman referensi menandai slot ini dengan `data-lg-lottie` dan Luge yang
 * memutarnya; karena runtime itu tidak dijalankan di sini, atribut tersebut tidak akan pernah
 * berbuat apa-apa dan slotnya akan tetap kosong. Jadi animasinya dimuat langsung lewat
 * `lottie-web` — pustaka yang sama, sudah jadi dependensi aplikasi, dan berkas .json yang sama.
 */
export function UspLottie({ name }: { name: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animation: { destroy: () => void } | null = null;
    let disposed = false;

    import("lottie-web").then(({ default: lottie }) => {
      if (disposed || !host.current) return;
      animation = lottie.loadAnimation({
        container: host.current,
        renderer: "svg",
        loop: true,
        autoplay: !reduced.matches,
        path: `/assets/lottie/${name}.json`,
      });
    });

    return () => {
      disposed = true;
      animation?.destroy();
    };
  }, [name]);

  return <div className="sb__illus__lottie" ref={host} aria-hidden="true" />;
}
