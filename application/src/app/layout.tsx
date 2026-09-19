import type { Metadata } from "next";
import { preload } from "react-dom";
import "./globals.css";
import { ThemeReveal } from "@/components/theme-motion";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import { withBase } from "@/lib/base-path";

export const metadata: Metadata = {
  title: "Survei Penilaian FSM UNDIP",
  description: "Sistem penilaian end-to-end Fakultas Sains dan Matematika UNDIP",
  // Berkas yang sama dipakai halaman publik (disalin ke public/assets oleh
  // scripts/prepare-application.mjs), jadi ikon tabnya tidak berubah saat berpindah dari situs ke
  // ruang survei. Tanpa ini Next memakai favicon bawaannya sendiri. Alamat ikon metadata tidak
  // diprefix basePath oleh Next, jadi awalannya diberi di sini.
  icons: {
    icon: [
      { url: withBase("/assets/favicon/favicon.svg?v=undip-1"), type: "image/svg+xml" },
      { url: withBase("/assets/favicon/favicon-32x32.png?v=undip-1"), sizes: "32x32", type: "image/png" },
      { url: withBase("/assets/favicon/favicon-16x16.png?v=undip-1"), sizes: "16x16", type: "image/png" },
    ],
    apple: withBase("/assets/favicon/apple-touch-icon.png?v=undip-1"),
    other: [{ rel: "mask-icon", url: withBase("/assets/favicon/safari-pinned-tab.svg?v=undip-1") }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Font tema dimuat lewat @font-face di globals.css, yang baru ditemukan peramban setelah CSS
  // selesai diunduh — teks sempat tampil dengan font cadangan lalu berganti. Preload membuat ketiganya
  // diunduh sejak HTML diterima.
  for (const font of ["HeyWow-Book", "HeyWow-SemiBold", "HeyWow-Bold"]) {
    preload(withBase(`/assets/fonts/${font}.woff2`), { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
       <a className="sr-only focus:not-sr-only" href="#app-content">Lewati ke konten</a>
       {/* Kepala situs: kunci merek dan menu memakai kelas tema yang sama dengan halaman publik
           (.s__logo, .site-head__menu), sehingga berpindah dari situs ke aplikasi tidak mengubah
           bentuk maupun perilaku navigasinya. Kelas .site-head sendiri tidak dipakai — ia pil
           melayang `position: fixed` yang akan menimpa bilah samping. */}
       <header className="survey-header">
        <div className="s__logo survey-header__logo">
         <a href={withBase("/")}>
          <img src={withBase("/assets/images/hero-home-undip.svg")} alt="Survei Penilaian FSM UNDIP" width="140" height="30"/>
          <span className="s__logo__label">Fakultas Sains dan Matematika<br/>Universitas Diponegoro</span>
         </a>
        </div>
        <nav aria-label="Navigasi publik">
         <ul className="site-head__menu">
          <li className="menu-item"><a href={withBase("/panduan-penilai")} className="menu-link"><span className="menu-item__text">Panduan</span></a></li>
          <li className="menu-item"><a href={withBase("/alur-penilaian")} className="menu-link"><span className="menu-item__text">Alur penilaian</span></a></li>
          <li className="menu-item"><a href={withBase("/dashboard")} className="menu-link"><span className="menu-item__text">Ruang survei ↗</span></a></li>
         </ul>
        </nav>
       </header>
       <div id="app-content">{children}</div><ThemeReveal /><RevealOnScroll />
       <footer className="survey-footer"><span>Survei Penilaian FSM UNDIP · Demonstrasi</span><a href={withBase("/kebijakan-privasi")}>Kebijakan privasi ↗</a></footer>
      </body>
    </html>
  );
}
