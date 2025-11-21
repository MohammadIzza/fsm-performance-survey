"use client";

import { useState, type ReactNode } from "react";

interface TabDef {
  key: string;
  label: string;
  /** Jumlah entri di balik tab, ditampilkan terpisah dari namanya. */
  count?: number;
  /** Satu kalimat tentang apa yang dikerjakan di tab itu. */
  hint?: string;
  content: ReactNode;
}

// Halaman kategori sebelumnya adalah satu kolom vertikal berisi 9 kartu bertumpuk (pengaturan,
// skala, parameter, 2× aturan kelompok, peserta, 2× aturan kelayakan, perencanaan, daftar tugas)
// — berat dipindai terutama di layar sempit. Dipecah jadi tab bertema; semua panel tetap ter-mount
// (disembunyikan lewat atribut `hidden`, bukan unmount) agar state form/edit di tiap panel tidak
// hilang saat berpindah tab.
export function CategoryTabs({ tabs, initialKey }: { tabs: TabDef[]; initialKey?: string }) {
  const initialTab = tabs.some((tab) => tab.key === initialKey) ? initialKey : tabs[0]?.key;
  const [active, setActive] = useState(initialTab);

  return (
    <div className="category-tabs">
      {/* Kelasnya sendiri, bukan utilitas garis tepi: aturan tombol umum di berkas gaya menyasar
          tombol mana pun yang membawa kelas `border-`, dan tab ini ikut tertangkap lalu berubah
          jadi pil besar — bentuk yang tidak dipakai navigasi mana pun di aplikasi ini. */}
      <div role="tablist" className="category-tabs__strip">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className="category-tabs__tab"
          >
            <span className="category-tabs__name">{t.label}</span>
            {t.count !== undefined && (
              <span className="category-tabs__count">{t.count}</span>
            )}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} hidden={active !== t.key} className="space-y-6">
          {t.hint && <p className="category-tabs__hint">{t.hint}</p>}
          {t.content}
        </div>
      ))}
    </div>
  );
}
