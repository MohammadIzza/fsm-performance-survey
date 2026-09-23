"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

/**
 * Kolom pilihan yang bisa diketik untuk mencari.
 *
 * Daftar pilihan bawaan peramban hanya bisa digulir: memilih satu nama dari ratusan pengguna
 * berarti menggulir lama. Komponen ini menggantikannya dengan kolom yang langsung bisa diketik
 * begitu diklik, dan daftar menyempit ke yang cocok.
 *
 * Hanya dipakai bila pilihannya lebih dari BATAS_CARI. Daftar pendek (jenis objek, kelompok, status)
 * tetap memakai <select> biasa — mengetik tidak menghemat apa pun di sana. Karena batas itu dicek
 * di sini, daftar yang tumbuh melewati batas (mis. jenis pengguna bertambah) otomatis ikut bisa dicari.
 *
 * Nilai dikirim lewat <input type="hidden" name=…>, jadi bekerja dengan formulir dan Server Action
 * yang ada tanpa perubahan di sisi server. Reset formulir (React mereset formulir setelah action
 * selesai) mengembalikan pilihan ke nilai awal.
 */

export const BATAS_CARI = 5;
/** Baris yang dirender sekaligus; sisanya ditemukan dengan mengetik. */
const BATAS_TAMPIL = 100;
const BATAS_LENCANA = 12;

export interface Opsi {
  value: string;
  label: string;
}

/** Huruf kecil tanpa tanda diakritik, supaya "rene" menemukan "René". */
function normal(teks: string) {
  return teks.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Cocok bila setiap kata yang diketik muncul di label, dalam urutan apa pun. */
function saring(opsi: Opsi[], kueri: string) {
  const kata = normal(kueri).split(/\s+/).filter(Boolean);
  if (kata.length === 0) return opsi;
  return opsi.filter((o) => {
    const label = normal(o.label);
    return kata.every((k) => label.includes(k));
  });
}

/** Posisi daftar mengikuti kolom isian. Dirender ke <body> agar tidak terpotong panel yang overflow-nya
 *  tersembunyi (baris daftar yang bisa dibuka-tutup), dan dibalik ke atas bila ruang di bawah sempit. */
function usePosisiDaftar(
  buka: boolean,
  jangkar: React.RefObject<HTMLElement | null>,
  /** Nilai yang bila berubah bisa menggeser kolom (mis. jumlah lencana pilihan ganda). */
  pemicu?: unknown
) {
  const [posisi, setPosisi] = useState<React.CSSProperties>({});
  useLayoutEffect(() => {
    if (!buka) return;
    const hitung = () => {
      const el = jangkar.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const tinggiMaks = 272;
      const bawah = window.innerHeight - r.bottom;
      const keAtas = bawah < Math.min(tinggiMaks, 180) && r.top > bawah;
      setPosisi({
        left: r.left,
        width: Math.max(r.width, 220),
        ...(keAtas
          ? { bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(tinggiMaks, r.top - 12) }
          : { top: r.bottom + 4, maxHeight: Math.min(tinggiMaks, bawah - 12) }),
      });
    };
    hitung();
    window.addEventListener("resize", hitung);
    window.addEventListener("scroll", hitung, true);
    return () => {
      window.removeEventListener("resize", hitung);
      window.removeEventListener("scroll", hitung, true);
    };
  }, [buka, jangkar, pemicu]);
  return posisi;
}

function useResetFormulir(input: React.RefObject<HTMLInputElement | null>, saatReset: () => void) {
  const panggil = useRef(saatReset);
  useEffect(() => {
    panggil.current = saatReset;
  });
  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const tangani = () => panggil.current();
    form.addEventListener("reset", tangani);
    return () => form.removeEventListener("reset", tangani);
  }, [input]);
}

type PropsTunggal = {
  name?: string;
  id?: string;
  options: Opsi[];
  /**
   * Pilihan bernilai kosong. `bisaDipilih: true` untuk pilihan nyata ("— Tanpa unit utama —");
   * `false` bila hanya teks petunjuk ("Pilih pengguna…").
   */
  kosong?: { label: string; bisaDipilih: boolean };
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function PilihanCari(props: PropsTunggal) {
  const { options, kosong, className = "" } = props;

  if (options.length <= BATAS_CARI) {
    const terkendali = props.value !== undefined;
    return (
      <select
        name={props.name}
        id={props.id}
        aria-label={props["aria-label"]}
        required={props.required}
        disabled={props.disabled}
        className={`form__control ${className}`.trim()}
        {...(terkendali
          ? { value: props.value, onChange: (e) => props.onChange?.(e.target.value) }
          : {
              defaultValue: props.defaultValue ?? "",
              onChange: (e) => props.onChange?.(e.target.value),
            })}
      >
        {kosong && (
          <option value="" disabled={!kosong.bisaDipilih}>
            {kosong.label}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return <KolomCari {...props} />;
}

function KolomCari({
  name,
  id,
  options,
  kosong,
  defaultValue = "",
  value,
  onChange,
  required,
  disabled,
  className = "",
  "aria-label": ariaLabel,
}: PropsTunggal) {
  const idOtomatis = useId();
  const idDaftar = `${id ?? idOtomatis}-daftar`;
  const inputRef = useRef<HTMLInputElement>(null);
  const daftarRef = useRef<HTMLUListElement>(null);

  const [nilaiSendiri, setNilaiSendiri] = useState(defaultValue);
  const nilai = value !== undefined ? value : nilaiSendiri;
  const labelNilai =
    options.find((o) => o.value === nilai)?.label ?? (nilai === "" && kosong?.bisaDipilih ? kosong.label : "");

  const [buka, setBuka] = useState(false);
  const [kueri, setKueri] = useState("");
  const [sedangMengetik, setSedangMengetik] = useState(false);
  const [sorot, setSorot] = useState(0);
  const labelKosong = kosong?.bisaDipilih ? kosong.label : null;
  const cocok = useMemo(() => {
    const hasil = saring(options, sedangMengetik ? kueri : "");
    return labelKosong !== null && !(sedangMengetik && kueri.trim())
      ? [{ value: "", label: labelKosong }, ...hasil]
      : hasil;
  }, [options, kueri, sedangMengetik, labelKosong]);
  const tampil = cocok.slice(0, BATAS_TAMPIL);

  const posisi = usePosisiDaftar(buka, inputRef);

  useResetFormulir(inputRef, () => {
    setNilaiSendiri(defaultValue);
    setBuka(false);
    setSedangMengetik(false);
  });

  const bukaDaftar = useCallback(() => {
    if (disabled) return;
    setBuka(true);
    setSedangMengetik(false);
    setKueri("");
    const i = cocok.findIndex((o) => o.value === nilai);
    setSorot(i >= 0 ? i : 0);
  }, [disabled, cocok, nilai]);

  const tutup = () => {
    setBuka(false);
    setSedangMengetik(false);
    setKueri("");
  };

  const pilih = (o: Opsi) => {
    if (value === undefined) setNilaiSendiri(o.value);
    onChange?.(o.value);
    inputRef.current?.setCustomValidity("");
    tutup();
  };

  // Baris yang disorot tetap terlihat saat berpindah dengan tombol panah.
  useEffect(() => {
    if (!buka) return;
    daftarRef.current?.querySelector<HTMLElement>(`[data-indeks="${sorot}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sorot, buka]);

  const tombol = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!buka) return bukaDaftar();
      const langkah = e.key === "ArrowDown" ? 1 : -1;
      setSorot((s) => Math.max(0, Math.min(tampil.length - 1, s + langkah)));
    } else if (e.key === "Enter") {
      if (!buka) return;
      // Enter di daftar yang terbuka memilih, bukan mengirim formulir.
      e.preventDefault();
      const o = tampil[sorot];
      if (o) pilih(o);
    } else if (e.key === "Escape" && buka) {
      e.preventDefault();
      tutup();
    }
  };

  // Pilihan yang sedang berlaku ditampilkan sebagai teks petunjuk (placeholder), bukan isi kolom. Dengan
  // begitu ketikan selalu memulai pencarian baru dari kolom kosong — tidak menyisip ke tengah nama yang
  // sudah terpilih, apa pun letak kursornya (mis. kolom masih fokus setelah memilih).
  const teksInput = sedangMengetik ? kueri : "";
  const terisi = labelNilai !== "";

  return (
    <span className={`pilihan-cari ${className}`.trim()}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={buka}
        aria-controls={idDaftar}
        aria-autocomplete="list"
        aria-activedescendant={buka && tampil[sorot] ? `${idDaftar}-${sorot}` : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        // Kolomnya selalu kosong saat tidak mengetik, jadi "wajib" diperiksa terhadap nilai terpilih.
        required={required && !terisi}
        placeholder={terisi ? labelNilai : buka ? "Ketik untuk mencari…" : kosong?.label ?? "Pilih…"}
        data-terisi={terisi && !sedangMengetik ? "true" : undefined}
        value={teksInput}
        className="form__control pilihan-cari__input"
        onFocus={bukaDaftar}
        onClick={() => {
          if (!buka) bukaDaftar();
        }}
        onChange={(e) => {
          if (!buka) setBuka(true);
          setSedangMengetik(true);
          setKueri(e.target.value);
          setSorot(0);
          e.currentTarget.setCustomValidity("");
        }}
        onKeyDown={tombol}
        onBlur={tutup}
        onInvalid={(e) => e.currentTarget.setCustomValidity("Pilih salah satu dari daftar.")}
      />
      {name && <input type="hidden" name={name} value={nilai} />}
      {buka &&
        createPortal(
          <ul
            ref={daftarRef}
            id={idDaftar}
            role="listbox"
            className="pilihan-cari__daftar"
            style={posisi}
            // Tetap fokus di kolom ketik saat daftar diklik, supaya daftar tidak tertutup lebih dulu.
            onMouseDown={(e) => e.preventDefault()}
          >
            {tampil.length === 0 && <li className="pilihan-cari__kosong">Tidak ada yang cocok.</li>}
            {tampil.map((o, i) => (
              <li
                key={o.value || "__kosong"}
                id={`${idDaftar}-${i}`}
                data-indeks={i}
                role="option"
                aria-selected={o.value === nilai}
                data-sorot={i === sorot ? "true" : undefined}
                className="pilihan-cari__opsi"
                onMouseMove={() => setSorot(i)}
                onClick={() => pilih(o)}
              >
                {o.label}
              </li>
            ))}
            {cocok.length > BATAS_TAMPIL && (
              <li className="pilihan-cari__kosong">
                Menampilkan {BATAS_TAMPIL} dari {cocok.length}. Ketik untuk mempersempit.
              </li>
            )}
          </ul>,
          document.body
        )}
    </span>
  );
}

type PropsBanyak = {
  name: string;
  id?: string;
  options: Opsi[];
  defaultValue?: string[];
  /** Mode terkendali: induk memegang daftar pilihan, misalnya untuk tombol "Pilih semua". */
  value?: string[];
  onChange?: (value: string[]) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
};

/**
 * Pilihan ganda yang bisa dicari. Pilihan tampil sebagai lencana di atas kolom ketik dan bisa
 * dilepas satu per satu; daftar tetap terbuka setelah memilih supaya beberapa bisa diambil berturut-turut.
 */
export function PilihanCariBanyak(props: PropsBanyak) {
  const { options, className = "" } = props;
  if (options.length <= BATAS_CARI) {
    return (
      <select
        name={props.name}
        id={props.id}
        aria-label={props["aria-label"]}
        multiple
        disabled={props.disabled}
        {...(props.value !== undefined
          ? { value: props.value }
          : { defaultValue: props.defaultValue ?? [] })}
        onChange={(e) => props.onChange?.(Array.from(e.target.selectedOptions, (o) => o.value))}
        /**
         * Klik biasa menambah atau melepas satu pilihan, tanpa menahan Ctrl/Cmd.
         *
         * Perilaku bawaan kotak daftar pilih-banyak adalah "klik = ganti seluruh pilihan": memilih
         * dua parameter menuntut Ctrl+klik, dan mengosongkan pilihan pun begitu. Tidak ada apa pun
         * di layar yang memberitahukan itu, jadi yang terjadi orang mengira hanya satu pilihan yang
         * mungkin. Di sini bawaannya dicegah, keadaan terpilih dibalik sendiri, lalu event change
         * dikirim supaya React tetap menerima perubahannya seperti biasa.
         */
        onMouseDown={(e) => {
          if (props.disabled) return;
          const opsi = (e.target as HTMLElement).closest("option");
          if (!opsi) return;
          e.preventDefault();
          const select = e.currentTarget;
          (opsi as HTMLOptionElement).selected = !(opsi as HTMLOptionElement).selected;
          select.focus();
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }}
        size={Math.max(2, options.length)}
        className={`form__control ${className}`.trim()}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return <KolomCariBanyak {...props} />;
}

function KolomCariBanyak({
  name,
  id,
  options,
  defaultValue = [],
  value,
  onChange,
  disabled,
  className = "",
  placeholder = "Ketik untuk mencari, lalu pilih…",
  "aria-label": ariaLabel,
}: PropsBanyak) {
  const idOtomatis = useId();
  const idDaftar = `${id ?? idOtomatis}-daftar`;
  const inputRef = useRef<HTMLInputElement>(null);
  const jangkarRef = useRef<HTMLSpanElement>(null);
  const daftarRef = useRef<HTMLUListElement>(null);

  const [nilaiSendiri, setNilaiSendiri] = useState<string[]>(defaultValue);
  const nilai = value !== undefined ? value : nilaiSendiri;
  const setNilai = (ubah: (sekarang: string[]) => string[]) => {
    const baru = ubah(nilai);
    if (value === undefined) setNilaiSendiri(baru);
    onChange?.(baru);
  };
  // Ratusan lencana sekaligus (hasil "Pilih semua") hanya membuat kolom memanjang; sisanya diringkas.
  const [semuaLencana, setSemuaLencana] = useState(false);
  const lencana = semuaLencana ? nilai : nilai.slice(0, BATAS_LENCANA);
  const [buka, setBuka] = useState(false);
  const [kueri, setKueri] = useState("");
  const [sorot, setSorot] = useState(0);
  const labelDari = useMemo(() => new Map(options.map((o) => [o.value, o.label])), [options]);
  const cocok = useMemo(() => saring(options, kueri), [options, kueri]);
  const tampil = cocok.slice(0, BATAS_TAMPIL);
  // Lencana yang bertambah atau berkurang menggeser kolom ketik; daftar ikut dipindah.
  const posisi = usePosisiDaftar(buka, jangkarRef, nilai.length);

  useResetFormulir(inputRef, () => {
    setNilai(() => defaultValue);
    setSemuaLencana(false);
    setKueri("");
    setBuka(false);
  });

  useEffect(() => {
    if (!buka) return;
    daftarRef.current?.querySelector<HTMLElement>(`[data-indeks="${sorot}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sorot, buka]);

  const alih = (v: string) =>
    setNilai((sekarang) => (sekarang.includes(v) ? sekarang.filter((x) => x !== v) : [...sekarang, v]));

  const tombol = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!buka) return setBuka(true);
      const langkah = e.key === "ArrowDown" ? 1 : -1;
      setSorot((s) => Math.max(0, Math.min(tampil.length - 1, s + langkah)));
    } else if (e.key === "Enter") {
      if (!buka) return;
      e.preventDefault();
      const o = tampil[sorot];
      if (o) alih(o.value);
    } else if (e.key === "Escape" && buka) {
      e.preventDefault();
      setBuka(false);
    } else if (e.key === "Backspace" && kueri === "" && nilai.length > 0) {
      setNilai((sekarang) => sekarang.slice(0, -1));
    }
  };

  return (
    <span className={`pilihan-cari pilihan-cari--banyak ${className}`.trim()}>
      {nilai.length > 0 && (
        <span className="pilihan-cari__terpilih">
          {lencana.map((v) => (
            <span key={v} className="pilihan-cari__lencana">
              {labelDari.get(v) ?? v}
              {!disabled && (
                <button
                  type="button"
                  className="pilihan-cari__lepas"
                  aria-label={`Lepas ${labelDari.get(v) ?? v}`}
                  onClick={() => alih(v)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          {nilai.length > BATAS_LENCANA && (
            <button
              type="button"
              className="pilihan-cari__lencana pilihan-cari__lencana--lagi"
              onClick={() => setSemuaLencana((x) => !x)}
            >
              {semuaLencana ? "Ringkas" : `+${nilai.length - BATAS_LENCANA} lainnya`}
            </button>
          )}
        </span>
      )}
      <span ref={jangkarRef} className="pilihan-cari__jangkar">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={buka}
          aria-controls={idDaftar}
          aria-autocomplete="list"
          aria-activedescendant={buka && tampil[sorot] ? `${idDaftar}-${sorot}` : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={nilai.length ? `${nilai.length} dipilih — ketik untuk menambah…` : placeholder}
          value={kueri}
          className="form__control pilihan-cari__input"
          onFocus={() => setBuka(true)}
          onClick={() => setBuka(true)}
          onChange={(e) => {
            setBuka(true);
            setKueri(e.target.value);
            setSorot(0);
          }}
          onKeyDown={tombol}
          onBlur={() => {
            setBuka(false);
            setKueri("");
          }}
        />
      </span>
      {nilai.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
      {buka &&
        createPortal(
          <ul
            ref={daftarRef}
            id={idDaftar}
            role="listbox"
            aria-multiselectable="true"
            className="pilihan-cari__daftar"
            style={posisi}
            onMouseDown={(e) => e.preventDefault()}
          >
            {tampil.length === 0 && <li className="pilihan-cari__kosong">Tidak ada yang cocok.</li>}
            {tampil.map((o, i) => (
              <li
                key={o.value}
                id={`${idDaftar}-${i}`}
                data-indeks={i}
                role="option"
                aria-selected={nilai.includes(o.value)}
                data-sorot={i === sorot ? "true" : undefined}
                className="pilihan-cari__opsi pilihan-cari__opsi--centang"
                onMouseMove={() => setSorot(i)}
                onClick={() => alih(o.value)}
              >
                {o.label}
              </li>
            ))}
            {cocok.length > BATAS_TAMPIL && (
              <li className="pilihan-cari__kosong">
                Menampilkan {BATAS_TAMPIL} dari {cocok.length}. Ketik untuk mempersempit.
              </li>
            )}
          </ul>,
          document.body
        )}
    </span>
  );
}
