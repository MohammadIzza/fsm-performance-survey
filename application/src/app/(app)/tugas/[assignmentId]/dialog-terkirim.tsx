"use client";

import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { ThemeButton } from "@/components/theme-button";

/**
 * Tanda bahwa penilaian sudah benar-benar diterima server. Mengirim adalah langkah terakhir dan
 * tidak bisa diulang sendiri, jadi cukup penting untuk diberi dialog tersendiri — bukan sekadar
 * notifikasi kecil yang mudah terlewat — sekaligus menawarkan langkah berikutnya: menilai tugas
 * lain yang belum selesai, atau kembali ke daftar.
 */
export function DialogTerkirim({
  buka,
  sisa,
  tugasBerikutnya,
  onTutup,
}: {
  buka: boolean;
  sisa: number;
  tugasBerikutnya: string | null;
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
            Penilaian terkirim
          </h2>
          <div className="konfirmasi__pesan">
            <p>
              Terima kasih, jawaban Anda sudah tersimpan dan terkunci.{" "}
              {sisa > 0
                ? `Masih ada ${sisa} penilaian lain yang menunggu Anda.`
                : "Semua penilaian Anda yang masih terbuka sudah selesai."}
            </p>
          </div>
          <div className="konfirmasi__aksi">
            <button
              type="button"
              className="konfirmasi__batal"
              autoFocus
              onClick={() => {
                onTutup();
                router.push(tugasBerikutnya ? "/tugas" : "/dashboard");
              }}
            >
              {tugasBerikutnya ? "Ke daftar tugas" : "Ke beranda"}
            </button>
            <ThemeButton
              type="button"
              className="konfirmasi__ya"
              onClick={() => {
                onTutup();
                router.push(tugasBerikutnya ? `/tugas/${tugasBerikutnya}` : "/tugas");
              }}
            >
              {tugasBerikutnya ? "Nilai berikutnya" : "Lihat daftar tugas"}
            </ThemeButton>
          </div>
        </div>
      )}
    </dialog>
  );
}
