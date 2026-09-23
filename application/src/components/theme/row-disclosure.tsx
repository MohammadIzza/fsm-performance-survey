"use client";

/**
 * Tombol buka-tutup untuk bidang tambahan sebuah baris daftar.
 *
 * Di desktop tombol ini menempati kolom Aksi. Di ponsel tombol tetap berada di ujung kanan baris,
 * sementara ringkasan hanya menampilkan nama entri. Panel di bawah baris memuat seluruh detail
 * dan tindakan CRUD, lalu dibuka dan ditutup oleh tombol yang sama.
 *
 * Keadaan terbuka hanya hidup sebagai atribut pada barisnya, bukan sebagai state React: yang perlu
 * berubah adalah panel saudaranya (CSS hanya bisa menurun, tidak bisa naik ke induk), dan dengan
 * `tunggal` sebuah baris juga menutup baris lain — yang tidak mungkin dilakukan state milik satu
 * baris sendiri.
 */
export function RowDisclosure({
  label = "detail",
  /**
   * Hanya satu baris boleh terbuka; membuka yang lain menutup yang sedang terbuka. Isinya pemilih
   * CSS untuk induk yang membatasi "yang lain" itu — misalnya wadah beberapa daftar sekaligus.
   * `true` berarti sebatas daftarnya sendiri.
   */
  tunggal = false,
}: {
  label?: string;
  tunggal?: boolean | string;
}) {
  return (
    <span className="sb__price sb__actions sb__disclosure">
      <button
        type="button"
        className="sb__detail-toggle"
        aria-expanded={false}
        aria-label={`Buka ${label}`}
        data-label={label}
        onClick={(e) => {
          const tombol = e.currentTarget;
          const baris = tombol.closest(".sb-course");
          if (!baris) return;
          const buka = baris.getAttribute("data-detail-open") !== "true";

          if (buka && tunggal) {
            const lingkup =
              (typeof tunggal === "string" ? baris.closest(tunggal) : null) ?? baris.closest(".s__courses");
            for (const lain of lingkup?.querySelectorAll('.sb-course[data-detail-open="true"]') ?? []) {
              if (lain === baris) continue;
              lain.setAttribute("data-detail-open", "false");
              const tombolLain = lain.querySelector<HTMLButtonElement>(".sb__detail-toggle");
              if (tombolLain) {
                tombolLain.setAttribute("aria-expanded", "false");
                tombolLain.setAttribute("aria-label", `Buka ${tombolLain.dataset.label ?? label}`);
              }
            }
          }

          baris.setAttribute("data-detail-open", buka ? "true" : "false");
          tombol.setAttribute("aria-expanded", buka ? "true" : "false");
          tombol.setAttribute("aria-label", `${buka ? "Tutup" : "Buka"} ${label}`);
        }}
      >
        <span className="period-stepper__arrow sb__detail-arrow" aria-hidden="true" />
      </button>
    </span>
  );
}
