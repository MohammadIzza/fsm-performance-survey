"use client";

import { useEffect, useRef } from "react";
import { withBase } from "@/lib/base-path";

/**
 * Huruf F-S-M dari beranda publik, dipakai ulang di halaman masuk.
 *
 * Gambarnya aset yang sama persis — /assets/lottie/home-hero-{f,s,m}.json — tetapi runtime-nya
 * bukan runtime tema. Di situs publik huruf-huruf ini dijalankan oleh rangkaian vendor (luge +
 * GSAP + pengendali hero) yang tidak ikut ke aplikasi Next ini; menariknya ke sini berarti memuat
 * mesin animasi kedua hanya demi satu halaman. Jadi yang dipakai di sini cuma pemutar Lottie-nya,
 * diimpor saat komponen dipasang sehingga tidak menambah berkas halaman lain, dan gerak naiknya
 * ditangani CSS.
 */
const HURUF = [
  { kunci: "f", berkas: "home-hero-f.json", jeda: 0 },
  { kunci: "s", berkas: "home-hero-s.json", jeda: 260 },
  { kunci: "m", berkas: "home-hero-m.json", jeda: 520 },
];

export function LoginHeroFsm() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const akar = ref.current;
    if (!akar) return;

    // Pengguna yang meminta gerak seminimal mungkin tetap mendapat hurufnya — hanya saja langsung
    // pada bingkai terakhir, tanpa mekar dan tanpa naik.
    const diamSaja = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let batal = false;
    const animasi: { destroy(): void; goToAndStop(v: number, f?: boolean): void; play(): void }[] = [];
    const tenggat: ReturnType<typeof setTimeout>[] = [];

    import("lottie-web/build/player/lottie_light")
      .then(({ default: lottie }) => {
        if (batal) return;
        for (const h of HURUF) {
          const wadah = akar.querySelector<HTMLElement>(`[data-huruf="${h.kunci}"]`);
          if (!wadah) continue;
          const anim = lottie.loadAnimation({
            container: wadah,
            renderer: "svg",
            loop: false,
            autoplay: false,
            path: withBase(`/assets/lottie/${h.berkas}`),
          });
          animasi.push(anim);
          anim.addEventListener("DOMLoaded", () => {
            if (batal) return;
            if (diamSaja) {
              anim.goToAndStop(anim.totalFrames - 1, true);
              return;
            }
            tenggat.push(setTimeout(() => anim.play(), h.jeda));
          });
        }
        akar.dataset.siap = "true";
      })
      .catch(() => {
        // Pemutar gagal dimuat: panel kiri tetap berisi judul dan teksnya, hurufnya saja yang
        // tidak muncul. Tidak ada yang perlu dilaporkan ke pengguna di halaman masuk.
      });

    return () => {
      batal = true;
      for (const t of tenggat) clearTimeout(t);
      for (const a of animasi) a.destroy();
    };
  }, []);

  return (
    <div className="login-fsm" ref={ref} aria-hidden="true">
      <div className="login-fsm__letters">
        {HURUF.map((h) => (
          <div key={h.kunci} className={`login-fsm__letter login-fsm__letter--${h.kunci}`}>
            <div className="login-fsm__flower" data-huruf={h.kunci} />
            <span className="login-fsm__stem" />
          </div>
        ))}
      </div>
      <img
        className="login-fsm__logo"
        src={withBase("/assets/images/hero-home-undip.svg")}
        alt=""
        aria-hidden="true"
        width={140}
        height={30}
      />
    </div>
  );
}
