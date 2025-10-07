"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ThemeButton } from "@/components/theme-button";

export interface OpsiKonfirmasi {
  /** Label kecil huruf kapital di atas judul, mis. "Kirim penilaian". */
  label?: string;
  judul: string;
  pesan: ReactNode;
  /** Teks tombol yang menjalankan aksinya. Tanpa ini dialog hanya pemberitahuan satu tombol. */
  tombolYa?: string;
  tombolBatal?: string;
}

/**
 * Dialog konfirmasi bergaya situs, pengganti window.confirm().
 *
 * confirm() bawaan peramban tampil sebagai kotak sistem — gelap di Android, berjudul nama domain
 * ("fsm.heyizza.my.id menyatakan"), dengan tombol dan huruf milik ponsel — di tengah halaman yang
 * seluruhnya memakai kartu, huruf, dan tombol tema. Dialog ini memakai <dialog> asli sehingga
 * fokus terkunci di dalamnya, Esc menutupnya, dan halaman di belakangnya tidak bisa disentuh.
 *
 * Pemakaian:
 *   const [konfirmasi, dialogKonfirmasi] = useKonfirmasi();
 *   if (await konfirmasi({ judul: "…", pesan: "…", tombolYa: "Kirim" })) { … }
 *   return <>{…}{dialogKonfirmasi}</>;
 */
export function useKonfirmasi() {
  const [opsi, setOpsi] = useState<OpsiKonfirmasi | null>(null);
  const penyelesai = useRef<((ya: boolean) => void) | null>(null);

  const konfirmasi = useCallback(
    (baru: OpsiKonfirmasi) =>
      new Promise<boolean>((selesai) => {
        penyelesai.current?.(false);
        penyelesai.current = selesai;
        setOpsi(baru);
      }),
    []
  );

  const tutup = useCallback((ya: boolean) => {
    penyelesai.current?.(ya);
    penyelesai.current = null;
    setOpsi(null);
  }, []);

  return [konfirmasi, <DialogKonfirmasi key="dialog-konfirmasi" opsi={opsi} onTutup={tutup} />] as const;
}

function DialogKonfirmasi({
  opsi,
  onTutup,
}: {
  opsi: OpsiKonfirmasi | null;
  onTutup: (ya: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const idJudul = useId();
  const idPesan = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (opsi && !dialog.open) dialog.showModal();
    if (!opsi && dialog.open) dialog.close();
  }, [opsi]);

  return (
    <dialog
      ref={ref}
      className="konfirmasi"
      aria-labelledby={idJudul}
      aria-describedby={idPesan}
      // Esc: dianggap batal, dan penutupannya lewat state supaya janji konfirmasi ikut selesai.
      onCancel={(e) => {
        e.preventDefault();
        onTutup(false);
      }}
      // Ketuk di luar kartu (latar gelap) juga membatalkan. Kartu mengisi seluruh <dialog>, jadi
      // klik yang sasarannya <dialog> itu sendiri hanya bisa berasal dari latarnya.
      onClick={(e) => {
        if (e.target === e.currentTarget) onTutup(false);
      }}
    >
      {opsi && (
        <div className="konfirmasi__kartu">
          {opsi.label && <p className="eyebrow konfirmasi__label">{opsi.label}</p>}
          <h2 id={idJudul} className="konfirmasi__judul">
            {opsi.judul}
          </h2>
          <div id={idPesan} className="konfirmasi__pesan">
            {opsi.pesan}
          </div>
          <div className="konfirmasi__aksi">
            {/* Fokus awal di tombol aman: Enter yang tak sengaja tidak menjalankan aksi final. */}
            <button
              type="button"
              className="konfirmasi__batal"
              onClick={() => onTutup(false)}
              autoFocus
            >
              {opsi.tombolBatal ?? (opsi.tombolYa ? "Batal" : "Mengerti")}
            </button>
            {opsi.tombolYa && (
              <ThemeButton type="button" className="konfirmasi__ya" onClick={() => onTutup(true)}>
                {opsi.tombolYa}
              </ThemeButton>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
