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
  { kunci: "f", berkas: "home-hero-f.json" },
  { kunci: "s", berkas: "home-hero-s.json" },
  { kunci: "m", berkas: "home-hero-m.json" },
];

/** Jeda antarhuruf, sama dengan animation-delay .login-fsm__letter di globals.css. */
const JEDA_ANTARHURUF = 110;

// Pemutar mulai diunduh begitu modul ini dievaluasi di peramban — sebelum hidrasi selesai — bukan
// menunggu useEffect. Di ponsel selisihnya ratusan milidetik kosong di bawah formulir.
const pemutar =
  typeof window === "undefined" ? null : import("lottie-web/build/player/lottie_light");

export function LoginHeroFsm() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const akar = ref.current;
    if (!akar || !pemutar) return;

    // Pengguna yang meminta gerak seminimal mungkin tetap mendapat hurufnya — hanya saja langsung
    // pada bingkai terakhir, tanpa mekar dan tanpa naik.
    const diamSaja = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Di layar sempit hurufnya kecil: animasi mekar Lottie (kepingan yang terbang menyusun huruf)
    // hanya terbaca sebagai serpihan acak yang bergerak bersamaan dengan gerak naik. Di sana huruf
    // langsung utuh dan hanya naik perlahan.
    const tanpaMekar = diamSaja || window.matchMedia("(max-width: 640px)").matches;
    let batal = false;
    const animasi: { destroy(): void; goToAndStop(v: number, f?: boolean): void; play(): void; totalFrames: number }[] = [];
    const tenggat: ReturnType<typeof setTimeout>[] = [];
    let bingkai = 0;
    let dimulai = false;

    // Gerak naik dan mekar dimulai bersama, dan baru setelah KETIGA huruf siap digambar. Sebelumnya
    // gerak naik dimulai begitu pustaka termuat — kotak kosong naik lebih dulu, lalu huruf muncul
    // mendadak di tengah jalan, masing-masing pada waktunya sendiri.
    const mulai = () => {
      if (batal || dimulai) return;
      dimulai = true;
      for (const [i, anim] of animasi.entries()) {
        if (tanpaMekar) anim.goToAndStop(anim.totalFrames - 1, true);
        else tenggat.push(setTimeout(() => anim.play(), i * JEDA_ANTARHURUF));
      }
      // Dua bingkai: yang pertama melukis huruf dalam keadaan awal (transparan, di bawah), yang
      // kedua baru memulai transisi — tanpa itu peramban bisa menggabungkan keduanya dan hurufnya
      // melompat. Pada saat itu kerja hidrasi juga sudah lewat, jadi geraknya tidak tersendat.
      bingkai = requestAnimationFrame(() => {
        bingkai = requestAnimationFrame(() => {
          if (!batal) akar.dataset.siap = "true";
        });
      });
    };

    pemutar
      .then(({ default: lottie }) => {
        if (batal) return;
        let siap = 0;
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
            siap += 1;
            if (siap === HURUF.length) mulai();
          });
        }
      })
      .catch(() => {
        // Pemutar gagal dimuat: hurufnya tidak muncul, tetapi lambang universitas tetap
        // ditampilkan. Tidak ada yang perlu dilaporkan ke pengguna di halaman masuk.
        mulai();
      });
    // Jaring pengaman bila salah satu berkas huruf tak kunjung termuat: tampilkan yang sudah ada
    // daripada membiarkan blok ini kosong.
    tenggat.push(setTimeout(mulai, 5000));

    return () => {
      batal = true;
      cancelAnimationFrame(bingkai);
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
