"use client";

import { createContext, useActionState, useCallback, useContext, useEffect, useRef, useState } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";

/**
 * Notifikasi singkat ("toast") setelah sebuah aksi berhasil — buat, ubah, hapus, kirim.
 *
 * Sebelumnya kebanyakan formulir admin diam saja setelah berhasil: halaman dimuat ulang oleh
 * revalidatePath dan datanya berubah, tapi tidak ada tanda bahwa perintahnya diterima. Pesan galat
 * tetap tampil di dalam formulirnya masing-masing (dekat isian yang salah); yang ditampilkan di sini
 * hanya tanda berhasil.
 *
 * Penyedianya dipasang di tata letak ruang survei, jadi notifikasi tetap terlihat walau aksinya
 * berpindah halaman (mis. salin periode yang mengarahkan ke periode baru).
 */

type Jenis = "berhasil" | "info";
interface Notifikasi {
  id: number;
  pesan: string;
  jenis: Jenis;
}

const KonteksNotifikasi = createContext<(pesan: string, jenis?: Jenis) => void>(() => {});

const LAMA_TAMPIL = 4200;

export function NotifikasiProvider({ children }: { children: React.ReactNode }) {
  const [daftar, setDaftar] = useState<Notifikasi[]>([]);
  const urutan = useRef(0);

  const tutup = useCallback((id: number) => setDaftar((d) => d.filter((n) => n.id !== id)), []);
  const beri = useCallback((pesan: string, jenis: Jenis = "berhasil") => {
    const id = ++urutan.current;
    // Paling banyak tiga sekaligus; yang lama tergeser.
    setDaftar((d) => [...d.slice(-2), { id, pesan, jenis }]);
  }, []);

  return (
    <KonteksNotifikasi.Provider value={beri}>
      {children}
      <div className="notifikasi" role="status" aria-live="polite">
        {daftar.map((n) => (
          <ItemNotifikasi key={n.id} notifikasi={n} onTutup={tutup} />
        ))}
      </div>
    </KonteksNotifikasi.Provider>
  );
}

function ItemNotifikasi({ notifikasi, onTutup }: { notifikasi: Notifikasi; onTutup: (id: number) => void }) {
  const [keluar, setKeluar] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setKeluar(true), LAMA_TAMPIL);
    const t2 = setTimeout(() => onTutup(notifikasi.id), LAMA_TAMPIL + 260);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [notifikasi.id, onTutup]);

  return (
    <div className={`notifikasi__item notifikasi__item--${notifikasi.jenis}`} data-keluar={keluar ? "true" : undefined}>
      <span className="notifikasi__ikon" aria-hidden="true">
        {notifikasi.jenis === "berhasil" ? "✓" : "i"}
      </span>
      <span className="notifikasi__pesan">{notifikasi.pesan}</span>
      <button type="button" className="notifikasi__tutup" aria-label="Tutup notifikasi" onClick={() => onTutup(notifikasi.id)}>
        ×
      </button>
    </div>
  );
}

export function useNotifikasi() {
  return useContext(KonteksNotifikasi);
}

type Pesan<S> = string | null | ((hasil: S, formData: FormData) => string | null);

function teksPesan<S>(pesan: Pesan<S>, hasil: S, formData: FormData) {
  return typeof pesan === "function" ? pesan(hasil, formData) : pesan;
}

/**
 * Sama dengan useActionState, ditambah notifikasi bila aksinya selesai tanpa `error`.
 * Aksi yang berakhir dengan redirect juga dianggap berhasil.
 */
export function useAksi<S extends { error?: string }>(
  aksi: (sebelum: S, formData: FormData) => Promise<S>,
  awal: S,
  pesan: Pesan<S>
) {
  const beri = useNotifikasi();
  return useActionState<S, FormData>(async (sebelum, formData) => {
    try {
      const hasil = await aksi(sebelum, formData);
      const teks = hasil?.error ? null : teksPesan(pesan, hasil, formData);
      if (teks) beri(teks);
      return hasil;
    } catch (e) {
      if (isRedirectError(e)) {
        const teks = teksPesan(pesan, awal as S, formData);
        if (teks) beri(teks);
      }
      throw e;
    }
  }, awal as Awaited<S>);
}

/** Untuk formulir tanpa status (aksi `Promise<void>`), mis. tombol Nonaktifkan atau Keluarkan. */
export function useAksiLangsung(aksi: (formData: FormData) => Promise<void>, pesan: string | ((formData: FormData) => string)) {
  const beri = useNotifikasi();
  return async (formData: FormData) => {
    await aksi(formData);
    beri(typeof pesan === "function" ? pesan(formData) : pesan);
  };
}
