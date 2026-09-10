import type { Metadata } from "next";
import "./globals.css";
import { ThemeReveal } from "@/components/theme-motion";
import { RevealOnScroll } from "@/components/reveal-on-scroll";

export const metadata: Metadata = {
  title: "Survei Penilaian FSM UNDIP",
  description: "Sistem penilaian end-to-end Fakultas Sains dan Matematika UNDIP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
         <a href="/">
          <img src="/assets/images/hero-home-undip.svg" alt="Survei Penilaian FSM UNDIP" width="140" height="30"/>
          <span className="s__logo__label">Fakultas Sains dan Matematika<br/>Universitas Diponegoro</span>
         </a>
        </div>
        <nav aria-label="Navigasi publik">
         <ul className="site-head__menu">
          <li className="menu-item"><a href="/panduan-penilai/" className="menu-link"><span className="menu-item__text">Panduan</span></a></li>
          <li className="menu-item"><a href="/alur-penilaian/" className="menu-link"><span className="menu-item__text">Alur penilaian</span></a></li>
          <li className="menu-item"><a href="/dashboard" className="menu-link"><span className="menu-item__text">Ruang survei ↗</span></a></li>
         </ul>
        </nav>
       </header>
       <div id="app-content">{children}</div><ThemeReveal /><RevealOnScroll />
       <footer className="survey-footer"><span>Survei Penilaian FSM UNDIP · Demonstrasi</span><a href="/kebijakan-privasi/">Kebijakan privasi ↗</a></footer>
      </body>
    </html>
  );
}
