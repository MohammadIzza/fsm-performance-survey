const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/**
 * Rentang tanggal dengan titik putus yang ditentukan, bukan dibiarkan seadanya.
 *
 * Sebagai teks biasa, "01 Jul 2026 – 31 Agu 2026" putus di mana pun kolomnya habis — sering di
 * tengah tanggal, sehingga "01 Jul" tertinggal di baris pertama dan "2026 – 31 Agu 2026" di baris
 * kedua. Tiap tanggal di sini dijaga utuh, dan satu-satunya tempat yang boleh putus adalah di
 * antara keduanya. Jadi kalau muat, keduanya sebaris; kalau tidak, tanggal awal di atas dan
 * tanggal akhir tepat di bawahnya.
 */
export function DateRange({ from, to }: { from: Date | string; to: Date | string }) {
  const start = dateFmt.format(new Date(from));
  const end = dateFmt.format(new Date(to));

  return (
    <span className="date-range">
      <span className="date-range__part">{start}</span>{" "}
      <span className="date-range__part">&ndash; {end}</span>
    </span>
  );
}

/** Satu tanggal, dijaga tidak pernah putus di tengah. */
export function DateValue({ value }: { value: Date | string }) {
  return <span className="date-range__part">{dateFmt.format(new Date(value))}</span>;
}
