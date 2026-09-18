"use client";

import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { ThemeButton } from "@/components/theme-button";

/**
 * Tanda bahwa kiriman satu lembar kategori sudah diterima server. Satu kiriman di sini mengurus
 * beberapa objek sekaligus, jadi yang disebut bukan sekadar "terkirim", melainkan berapa objek
 * yang terkunci, berapa yang baru tersimpan sebagai draf karena belum lengkap, dan berapa yang
 * gagal — supaya tidak ada yang mengira seluruh halaman sudah selesai padahal belum.
 */
export function DialogLembar({
  buka,
  terkirim,
  draf,
  gagal,
  onTutup,
}: {
  buka: boolean;
  terkirim: number;
  draf: number;
  gagal: number;
  onTutup: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const idJudul = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (buka && !dialog.open) dialog.showModal();
    if (!buka && dialog.open) dialog.close();
  }, [buka]);

  const selesaiSemua = draf === 0 && gagal === 0;

  return (
    <dialog
      ref={ref}
      className="konfirmasi konfirmasi--berhasil"
      aria-labelledby={idJudul}
      onCancel={(e) => {
        e.preventDefault();
        onTutup();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onTutup();
      }}
    >
      {buka && (
        <div className="konfirmasi__kartu">
          <span className="konfirmasi__centang" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l4.2 4.2L19 7" />
            </svg>
          </span>
          <h2 id={idJudul} className="konfirmasi__judul">
            {terkirim > 0 ? `${terkirim} penilaian terkirim` : "Belum ada yang terkirim"}
          </h2>
          <div className="konfirmasi__pesan">
            <p>
              {terkirim > 0
                ? "Jawaban untuk objek yang lengkap sudah tersimpan dan terkunci."
                : "Tidak ada objek yang isiannya lengkap, jadi belum ada yang dikunci."}
              {draf > 0 && ` ${draf} objek belum lengkap dan disimpan sebagai draf.`}
              {gagal > 0 && ` ${gagal} objek gagal tersimpan — pesannya ada di barisnya masing-masing.`}
            </p>
          </div>
          <div className="konfirmasi__aksi">
            <button
              type="button"
              className="konfirmasi__batal"
              autoFocus
              onClick={() => {
                onTutup();
                router.push("/tugas");
              }}
            >
              Ke daftar tugas
            </button>
            <ThemeButton
              type="button"
              className="konfirmasi__ya"
              onClick={() => {
                onTutup();
                if (selesaiSemua) router.push("/tugas");
              }}
            >
              {selesaiSemua ? "Selesai" : "Lanjut mengisi"}
            </ThemeButton>
          </div>
        </div>
      )}
    </dialog>
  );
}
