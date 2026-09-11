"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Jendela geser untuk bagan organisasi.
 *
 * Bagan selebar isinya, dan dengan enam departemen serta tiga belas program studi isinya lebih
 * lebar daripada layar mana pun. Tanpa penyesuaian, yang terlihat saat halaman dibuka adalah tepi
 * kiri pohon — cabang paling kiri, tanpa akarnya — sehingga bagan terbaca seperti terpotong.
 * Di sini tampilannya digeser ke akar lebih dulu, dan keterangan geser hanya muncul bila memang
 * ada yang berada di luar layar.
 */
export function OrgTreeViewport({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [meluber, setMeluber] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const pusatkan = () => {
      setMeluber(el.scrollWidth > el.clientWidth + 1);
      const akar = el.querySelector(".org-tree__node--root");
      if (!akar) return;
      const kotak = akar.getBoundingClientRect();
      const jendela = el.getBoundingClientRect();
      el.scrollLeft += kotak.left - jendela.left - (jendela.width - kotak.width) / 2;
    };

    pusatkan();
    // Lebar jendela berubah saat panel samping dibuka/ditutup atau layar diputar; akar dijaga
    // tetap di tengah supaya pembacaan bagan tidak berpindah titik mulai.
    const pengamat = new ResizeObserver(pusatkan);
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, []);

  return (
    <>
      {meluber && (
        <p className="org-tree__hint">Geser bagan ke samping untuk melihat seluruh cabang.</p>
      )}
      <div ref={ref} className="app-table-wrap">
        {children}
      </div>
    </>
  );
}
