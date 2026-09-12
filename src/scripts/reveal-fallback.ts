// Animasi pengungkap tema bekerja lewat satu kelas: luge memasang `is-in` pada elemen ber-atribut
// data-lg-reveal begitu elemen itu masuk layar, dan CSS tema-lah yang menganimasikan sisanya.
//
// Sampai kelas itu datang, elemennya berada di keadaan istirahat — dan untuk sebagian seksi
// keadaan istirahat itu bukan "versi belum beranimasi", melainkan tidak terbaca sama sekali.
// Seksi video di beranda contohnya: bidang videonya dipotong `clip-path: circle(0%)`, tombol
// putarnya ikut terpotong, dan yang tersisa di layar hanya blok biru dan kuning polos tanpa isi.
//
// Luge memasang kelas itu dari penangan gulir miliknya sendiri. Kalau gulirannya tidak sampai ke
// penangan itu — halaman dibuka sudah dalam keadaan tergulir, lompatan ke jangkar, gulir sangat
// cepat, atau runtime-nya baru selesai dimuat setelah pengguna terlanjur menggulir — seksinya
// berhenti di keadaan istirahat selamanya.
//
// Penjaga ini tidak menggantikan animasinya. Ia hanya memastikan keadaan istirahat tidak pernah
// menjadi keadaan akhir: elemen yang sudah cukup lama terlihat di layar tetapi belum juga
// menerima `is-in` diberi kelas itu di sini. Pada muat halaman yang sehat luge selalu lebih dulu,
// dan penjaga ini tidak pernah melakukan apa pun.

// Cukup lama untuk kalah cepat dari luge pada keadaan normal, cukup singkat untuk tidak menyisakan
// seksi kosong yang terlihat janggal.
const BATAS_TERTINGGAL = 1200;

const penghitung = new WeakMap<Element, ReturnType<typeof setTimeout>>();

function bereskan(el: Element) {
  const t = penghitung.get(el);
  if (t !== undefined) {
    clearTimeout(t);
    penghitung.delete(el);
  }
}

const pengamat = new IntersectionObserver(
  (entri) => {
    for (const e of entri) {
      if (!e.isIntersecting) {
        bereskan(e.target);
        continue;
      }
      if (e.target.classList.contains("is-in") || penghitung.has(e.target)) continue;
      penghitung.set(
        e.target,
        setTimeout(() => {
          penghitung.delete(e.target);
          if (e.target.classList.contains("is-in")) return;
          e.target.classList.add("is-in");
          e.target.classList.remove("is-out");
        }, BATAS_TERTINGGAL)
      );
    }
  },
  { threshold: 0.12 }
);

function amati(akar: ParentNode) {
  for (const el of akar.querySelectorAll("[data-lg-reveal]")) pengamat.observe(el);
}

amati(document);

// Luge menukar isi halaman saat berpindah antar-halaman, jadi elemen yang baru masuk DOM ikut
// diamati. MutationObserver dipakai, bukan peristiwa luge, supaya penjaga ini tetap bekerja
// walau runtime temanya gagal dimuat sama sekali.
new MutationObserver((mutasi) => {
  for (const m of mutasi) {
    for (const n of m.addedNodes) {
      if (!(n instanceof Element)) continue;
      if (n.hasAttribute("data-lg-reveal")) pengamat.observe(n);
      amati(n);
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true });
