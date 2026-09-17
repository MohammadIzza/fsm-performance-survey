"use client";

import { useState } from "react";
import { useAksi } from "@/components/theme/notifikasi";
import { TombolHapus } from "@/components/theme/tombol-hapus";

type Aksi = (prev: { error?: string }, fd: FormData) => Promise<{ error?: string }>;
export type Jenis = { id: string; name: string; dipakai: string; bawaan?: boolean };

/** Daftar jenis (pengguna atau objek) yang bisa diganti namanya dan dihapus bila belum dipakai. */
export function DaftarJenis({
  jenis,
  aksiUbah,
  aksiHapus,
  sebutan,
}: {
  jenis: Jenis[];
  aksiUbah: Aksi;
  aksiHapus: Aksi;
  /** "jenis pengguna" / "jenis objek" */
  sebutan: string;
}) {
  return (
    <ul className="daftar-jenis">
      {jenis.map((j) => (
        <BarisJenis key={j.id} jenis={j} aksiUbah={aksiUbah} aksiHapus={aksiHapus} sebutan={sebutan} />
      ))}
    </ul>
  );
}

function BarisJenis({ jenis, aksiUbah, aksiHapus, sebutan }: { jenis: Jenis; aksiUbah: Aksi; aksiHapus: Aksi; sebutan: string }) {
  const [ubah, setUbah] = useState(false);
  const [state, formAction, pending] = useAksi(aksiUbah, {}, `Nama ${sebutan} disimpan.`);

  return (
    <li className="daftar-jenis__baris">
      {ubah ? (
        <form
          action={async (fd) => {
            await formAction(fd);
            setUbah(false);
          }}
          className="daftar-jenis__ubah"
        >
          <input type="hidden" name="id" value={jenis.id} />
          <input name="name" defaultValue={jenis.name} required aria-label={`Nama ${sebutan}`} className="form__control" />
          <button type="submit" disabled={pending} className="app-btn app-btn--primary">
            {pending ? "Menyimpan…" : "Simpan"}
          </button>
          <button type="button" className="app-btn app-btn--polos" onClick={() => setUbah(false)}>
            Batal
          </button>
        </form>
      ) : (
        <>
          <span className="daftar-jenis__nama">
            <strong>{jenis.name}</strong>
            <small>{jenis.dipakai}</small>
          </span>
          <span className="daftar-jenis__aksi">
            <button type="button" className="daftar-jenis__tombol" onClick={() => setUbah(true)}>
              Ubah nama
            </button>
            {!jenis.bawaan && (
              <TombolHapus
                aksi={aksiHapus}
                id={jenis.id}
                label="Hapus"
                className="daftar-jenis__tombol daftar-jenis__tombol--hapus"
                judul={`Hapus ${sebutan} "${jenis.name}"?`}
                pesan={<p>Hanya bisa dihapus bila belum dipakai. Tindakan ini tidak bisa dibatalkan.</p>}
                berhasil={`${sebutan[0].toUpperCase()}${sebutan.slice(1)} dihapus.`}
              />
            )}
          </span>
        </>
      )}
      {state.error && (
        <p role="alert" className="tombol-hapus__galat">
          {state.error}
        </p>
      )}
    </li>
  );
}
