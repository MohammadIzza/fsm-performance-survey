"use client";

import type { ReactNode } from "react";
import { useAksi } from "@/components/theme/notifikasi";
import { useKonfirmasi } from "@/components/theme/confirm-dialog";

type Aksi = (prev: { error?: string }, fd: FormData) => Promise<{ error?: string }>;

/**
 * Tombol hapus permanen dengan dialog konfirmasi tema. Bila server menolak (mis. data masih
 * dipakai), alasannya tampil di bawah tombol; bila berhasil, notifikasi muncul.
 */
export function TombolHapus({
  aksi,
  id,
  label,
  judul,
  pesan,
  berhasil,
  className = "app-btn app-btn--danger",
}: {
  aksi: Aksi;
  id: string;
  /** Teks tombol, mis. "Hapus unit". */
  label: string;
  /** Judul dialog, mis. "Hapus unit Sarjana Kimia?". */
  judul: string;
  pesan: ReactNode;
  /** Isi notifikasi setelah berhasil. */
  berhasil: string;
  className?: string;
}) {
  const [state, formAction, pending] = useAksi(aksi, {}, berhasil);
  const [konfirmasi, dialog] = useKonfirmasi();

  return (
    <form
      action={formAction}
      className="tombol-hapus"
      onSubmit={async (e) => {
        if (e.currentTarget.dataset.disetujui === "1") {
          delete e.currentTarget.dataset.disetujui;
          return;
        }
        e.preventDefault();
        const form = e.currentTarget;
        const ya = await konfirmasi({ label: "Hapus permanen", judul, pesan, tombolYa: label, tombolBatal: "Batal" });
        if (ya) {
          form.dataset.disetujui = "1";
          form.requestSubmit();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className={className}>
        {pending ? "Menghapus…" : label}
      </button>
      {state.error && (
        <p role="alert" className="tombol-hapus__galat">
          {state.error}
        </p>
      )}
      {dialog}
    </form>
  );
}
