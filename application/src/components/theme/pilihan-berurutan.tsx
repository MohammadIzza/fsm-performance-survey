"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pilihan ganda yang urutan memilihnya ikut disimpan, dan terlihat.
 *
 * Kotak daftar pilih-banyak bawaan peramban tidak bisa dipakai di sini: ia selalu mengirim pilihan
 * dalam urutan daftar, bukan urutan orang memilihnya, dan tidak punya tempat menaruh nomor urut.
 * Yang dipakai di sini daftar tombol biasa — nilainya dikirim lewat <input type="hidden"> dalam
 * urutan pilih, jadi formulir dan Server Action yang ada tidak perlu tahu bedanya.
 *
 * Dipakai untuk parameter pembeda nilai sama, tempat urutan itu berarti prioritas: yang dipilih
 * lebih dulu diperiksa lebih dulu saat dua objek bernilai sama.
 */
export function PilihanBerurutan({
  name,
  options,
  defaultValue = [],
  disabled = false,
  "aria-label": ariaLabel,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string[];
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const [terpilih, setTerpilih] = useState<string[]>(defaultValue);
  const wadahRef = useRef<HTMLDivElement>(null);

  // React mereset formulir setelah Server Action selesai; pilihan ikut kembali ke nilai awalnya.
  const awal = useRef(defaultValue);
  useEffect(() => {
    const form = wadahRef.current?.closest("form");
    if (!form) return;
    const tangani = () => setTerpilih(awal.current);
    form.addEventListener("reset", tangani);
    return () => form.removeEventListener("reset", tangani);
  }, []);

  const alih = (value: string) =>
    setTerpilih((sekarang) =>
      sekarang.includes(value) ? sekarang.filter((v) => v !== value) : [...sekarang, value]
    );

  return (
    <div className="pilihan-urut" ref={wadahRef}>
      <ul className="pilihan-urut__daftar" role="listbox" aria-multiselectable aria-label={ariaLabel}>
        {options.map((o) => {
          const urutan = terpilih.indexOf(o.value);
          const aktif = urutan >= 0;
          return (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={aktif}
                disabled={disabled}
                className="pilihan-urut__opsi"
                data-aktif={aktif ? "true" : undefined}
                onClick={() => alih(o.value)}
              >
                <span className="pilihan-urut__label">{o.label}</span>
                {/* Nomor urut di ujung kanan, hanya pada yang terpilih: slot kosong di depan setiap
                    nama hanya menyisakan lajur kosong di kiri. Dibacakan pembaca layar sebagai
                    prioritas, karena urutan itulah yang menentukan parameter mana diperiksa dulu. */}
                {aktif && (
                  <span className="pilihan-urut__nomor">
                    {urutan + 1}
                    <span className="sr-only"> prioritas ke-{urutan + 1}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {terpilih.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </div>
  );
}
