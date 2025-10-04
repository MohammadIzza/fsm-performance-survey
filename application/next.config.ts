import type { NextConfig } from "next";
import { BASE_PATH } from "../base-path.mjs";

const nextConfig: NextConfig = {
  // Aplikasi dilayani gateway UNDIP di https://apps-fsm.undip.ac.id/survey/ dengan awalan diteruskan
  // utuh. basePath memprefix /_next/, berkas public/, <Link>, router, dan redirect(); alamat lain yang
  // ditulis tangan memakai withBase() dari src/lib/base-path.ts.
  basePath: BASE_PATH,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  poweredByHeader: false,
  // Berkas statis halaman publik dan tema (public/_astro, public/assets) dilayani Next dengan
  // `max-age=0`: setiap kunjungan menanyakan ulang puluhan berkas ke server, satu per satu lewat
  // gateway HTTP/1.1. Sumber di sini relatif terhadap basePath. Bila dua aturan cocok, yang terakhir
  // menang — jadi aturan umum lebih dulu, yang khusus sesudahnya.
  async headers() {
    const seminggu = "public, max-age=604800, stale-while-revalidate=86400";
    const selamanya = "public, max-age=31536000, immutable";
    return [
      // Gambar, font, Lottie, video, dan skrip tema tanpa hash. Berkas yang isinya diganti diberi
      // nama baru (mis. tutorial-survei-fsm-v2.mp4), skrip tema diberi ?v=versi.
      { source: "/assets/:path*", headers: [{ key: "Cache-Control", value: seminggu }] },
      // Nama berisi hash isi: tidak pernah berubah, boleh disimpan selamanya.
      { source: "/_astro/:path*", headers: [{ key: "Cache-Control", value: selamanya }] },
      // Potongan tema (1234-<hash>.js) dan skrip tema gabungan (tema-<hash>.js, dibuat
      // integrations/preload-tema.mjs).
      {
        source: "/assets/js/:file((?:\\d+|tema)-[0-9a-f]{20}\\.js)",
        headers: [{ key: "Cache-Control", value: selamanya }],
      },
    ];
  },
};

export default nextConfig;
