"use client";

import { useState, type ReactNode } from "react";

interface TabDef {
  key: string;
  label: string;
  content: ReactNode;
}

// Halaman kategori sebelumnya adalah satu kolom vertikal berisi 9 kartu bertumpuk (pengaturan,
// skala, parameter, 2× aturan kelompok, peserta, 2× aturan kelayakan, perencanaan, daftar tugas)
// — berat dipindai terutama di layar sempit. Dipecah jadi tab bertema; semua panel tetap ter-mount
// (disembunyikan lewat atribut `hidden`, bukan unmount) agar state form/edit di tiap panel tidak
// hilang saat berpindah tab.
export function CategoryTabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div>
      <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--border)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-[14px] font-medium transition ${
              active === t.key
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} hidden={active !== t.key} className="space-y-6">
          {t.content}
        </div>
      ))}
    </div>
  );
}
