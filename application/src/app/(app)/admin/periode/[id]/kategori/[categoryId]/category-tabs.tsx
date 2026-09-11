"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface TabDef {
  key: string;
  label: string;
  /** Jumlah entri di balik tab, ditampilkan terpisah dari namanya. */
  count?: number;
  /** Satu kalimat tentang apa yang dikerjakan di tab itu. */
  hint?: string;
  /** Judul berbentuk tindakan agar tujuan bagian langsung terbaca oleh admin. */
  title?: string;
  /** Kondisi sederhana yang menandakan bagian ini sudah selesai. */
  completion?: string;
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
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.key === active));
  const activeTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Di ponsel bilah tab dapat digeser mendatar. Pastikan bagian yang diminta lewat URL langsung
    // terlihat, terutama Pembagian Tugas yang berada paling kanan.
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  function selectTab(key: string) {
    setActive(key);

    // Nama bagian ikut tersimpan di alamat. Admin dapat memuat ulang atau membagikan tautan dan
    // tetap kembali ke bagian yang sedang dikerjakan, bukan selalu ke tab pertama.
    const url = new URL(window.location.href);
    url.searchParams.set("bagian", key);
    window.history.replaceState(null, "", url);
  }

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
            aria-controls={`category-panel-${t.key}`}
            id={`category-tab-${t.key}`}
            ref={active === t.key ? activeTabRef : undefined}
            onClick={() => selectTab(t.key)}
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
        <div
          key={t.key}
          id={`category-panel-${t.key}`}
          role="tabpanel"
          aria-labelledby={`category-tab-${t.key}`}
          hidden={active !== t.key}
          className="space-y-6"
        >
          {(t.title || t.hint) && (
            <div className="category-tabs__guide">
              <p className="category-tabs__step">
                Bagian {activeIndex + 1} dari {tabs.length}
              </p>
              {t.title && <h2>{t.title}</h2>}
              {t.hint && <p className="category-tabs__hint">{t.hint}</p>}
              {t.completion && (
                <p className="category-tabs__completion">
                  <strong>Selesai jika:</strong> {t.completion}
                </p>
              )}
            </div>
          )}
          {t.content}
        </div>
      ))}
    </div>
  );
}
