"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Panel buka-tutup memakai komponen tanya-jawab tema (`.s-faq` + `.sb-question`) — bentuk yang
 * sama dipakai bagian tanya-jawab di halaman panduan: kotak beige, ikon plus yang berputar jadi
 * minus saat terbuka, dan titik penanda di tepi kiri.
 *
 * Di situs publik tingginya dianimasikan oleh GSAP dari 0 ke tinggi isi. Di sini dipakai aturan
 * tema `.is-opened .sb__inner { height: auto }` apa adanya — bukaannya langsung, tanpa transisi
 * tinggi. Menganimasikan `height: auto` butuh pengukuran per-elemen, dan itu berarti menulis ulang
 * bagian GSAP yang justru ingin dihindari.
 *
 * Judulnya adalah <button> sungguhan, bukan <div> ber-onClick seperti di tema, supaya bisa dicapai
 * lewat papan ketik dan status buka/tutupnya terbaca pembaca layar.
 */
export function Disclosure({
  question,
  children,
  defaultOpen = false,
  accent = "green",
}: {
  question: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  accent?: "green" | "pink" | "blue";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={`sb-question${open ? " is-opened" : ""}`}>
      <button
        type="button"
        className="sb__question"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={`a-bullet-point a-bullet-point--outline a-bullet-point--${accent}`}
          aria-hidden="true"
        />
        {question}
      </button>
      <span className="sb__icon" aria-hidden="true">
        <span className="sb__icon__line" />
        <span className="sb__icon__line" />
      </span>
      <div className="sb__inner" id={panelId} hidden={!open}>
        <div className="sb__answer">{children}</div>
      </div>
    </div>
  );
}

/** Pembungkus sekelompok panel — memberi konteks `.s-faq` yang dipakai aturan gaya di atas. */
export function DisclosureGroup({ children }: { children: ReactNode }) {
  return (
    <div className="s-faq">
      <div className="s__questions">{children}</div>
    </div>
  );
}
