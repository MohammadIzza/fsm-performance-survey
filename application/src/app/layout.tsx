import type { Metadata } from "next";
import "./globals.css";
import { ThemeReveal } from "@/components/theme-motion";

export const metadata: Metadata = {
  title: "Survei Penilaian FSM UNDIP",
  description: "Sistem penilaian end-to-end Fakultas Sains dan Matematika UNDIP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
       <a className="sr-only focus:not-sr-only" href="#app-content">Lewati ke konten</a>
       <header className="survey-header"><a href="/" className="survey-brand"><img src="/assets/images/hero-home-undip.svg" alt="Survei FSM UNDIP" width="140" height="30"/><small>Fakultas Sains dan Matematika<br/>Universitas Diponegoro</small></a><nav aria-label="Navigasi publik"><a href="/panduan-penilai/">Panduan</a><a href="/alur-penilaian/">Alur penilaian</a><a href="/dashboard">Ruang survei ↗</a></nav></header>
       <div id="app-content">{children}</div><ThemeReveal />
       <footer className="survey-footer"><span>Survei Penilaian FSM UNDIP · Demonstrasi</span><a href="/kebijakan-privasi/">Kebijakan privasi ↗</a></footer>
      </body>
    </html>
  );
}
