"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Ikon ⓘ kecil di samping istilah yang membingungkan. Keterangannya muncul saat ikon disorot
 * (mouse), difokus (keyboard), atau diketuk (layar sentuh — ketuk lagi atau ketuk di luar untuk
 * menutup).
 *
 * Gelembungnya dipasang ke <body> dengan posisi tetap, bukan anak ikon: banyak ikon berada di dalam
 * tabel yang bisa digeser mendatar (overflow) dan panel accordion, yang akan memotong gelembung
 * bila ia ikut di dalamnya. Gelembung ditaruh di atas ikon; bila tidak muat, di bawahnya, dan
 * digeser mendatar supaya tidak keluar layar.
 */
export function Info({ children, label = "Keterangan" }: { children: ReactNode; label?: string }) {
  const id = useId();
  const tombol = useRef<HTMLButtonElement>(null);
  const gelembung = useRef<HTMLSpanElement>(null);
  const [sorot, setSorot] = useState(false);
  const [kunci, setKunci] = useState(false);
  const [posisi, setPosisi] = useState<{ top: number; left: number; bawah: boolean } | null>(null);
  const buka = sorot || kunci;

  const hitung = useCallback(() => {
    const t = tombol.current?.getBoundingClientRect();
    const g = gelembung.current?.getBoundingClientRect();
    if (!t || !g) return;
    const jarak = 8;
    const bawah = t.top - g.height - jarak < 8;
    const top = bawah ? t.bottom + jarak : t.top - g.height - jarak;
    const left = Math.min(Math.max(8, t.left + t.width / 2 - g.width / 2), window.innerWidth - g.width - 8);
    setPosisi({ top, left, bawah });
  }, []);

  useLayoutEffect(() => {
    if (buka) hitung();
  }, [buka, hitung]);

  useEffect(() => {
    if (!buka) return;
    const tutupLuar = (e: PointerEvent) => {
      if (!tombol.current?.contains(e.target as Node)) {
        setKunci(false);
        setSorot(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setKunci(false);
        setSorot(false);
      }
    };
    window.addEventListener("scroll", hitung, true);
    window.addEventListener("resize", hitung);
    document.addEventListener("pointerdown", tutupLuar);
    document.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("scroll", hitung, true);
      window.removeEventListener("resize", hitung);
      document.removeEventListener("pointerdown", tutupLuar);
      document.removeEventListener("keydown", esc);
    };
  }, [buka, hitung]);

  return (
    <>
      <button
        ref={tombol}
        type="button"
        className="info"
        aria-label={label}
        aria-describedby={buka ? id : undefined}
        aria-expanded={buka}
        onMouseEnter={() => setSorot(true)}
        onMouseLeave={() => setSorot(false)}
        onFocus={() => setSorot(true)}
        onBlur={() => {
          setSorot(false);
          setKunci(false);
        }}
        onClick={(e) => {
          // Di dalam <label> atau <summary>, klik ikon tidak boleh ikut mengaktifkan isian/accordion.
          e.preventDefault();
          e.stopPropagation();
          setKunci((k) => !k);
        }}
      >
        {/* Lambang gambar, bukan huruf "i": pada ukuran sekecil ini huruf tunggal terbaca sebagai
            noda tinta, sedangkan lingkaran bertitik dikenali sebagai tanda keterangan. */}
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="info__ikon">
          <circle cx="12" cy="12" r="9.25" />
          <path d="M12 11.1v5.4" />
          <circle cx="12" cy="7.6" r="1.15" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {buka &&
        createPortal(
          <span
            ref={gelembung}
            id={id}
            role="tooltip"
            className="info__gelembung"
            data-bawah={posisi?.bawah ? "true" : undefined}
            style={posisi ? { top: posisi.top, left: posisi.left } : { top: -9999, left: -9999 }}
          >
            {children}
          </span>,
          document.body
        )}
    </>
  );
}

/**
 * Label yang membawa ikon keterangan, mis. judul kartu ringkasan. Kata terakhir labelnya dan ikonnya
 * dibungkus satu potongan yang dilarang berganti baris: tanpa itu ikon dihitung sebagai "kata"
 * berikutnya dan turun sendirian ke baris baru begitu labelnya nyaris selebar kartunya. Sekarang
 * yang turun adalah kata terakhir bersama ikonnya, jadi ikon tidak pernah berdiri sendiri.
 */
export function InfoLabel({ children, ket }: { children: ReactNode; ket: ReactNode }) {
  if (typeof children !== "string") {
    return (
      <>
        {children}
        <Info>{ket}</Info>
      </>
    );
  }
  const pisah = children.lastIndexOf(" ");
  return (
    <>
      {children.slice(0, pisah + 1)}
      <span className="info-ekor">
        {children.slice(pisah + 1)}
        <Info>{ket}</Info>
      </span>
    </>
  );
}
