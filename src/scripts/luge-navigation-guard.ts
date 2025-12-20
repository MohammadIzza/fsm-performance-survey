// Luge menukar isi halaman lewat "cycle": serangkaian peristiwa (pageFetch, pageOut, pageCreate,
// …, reveal) yang tiap tahapnya menunggu semua callback tahap itu memanggil done() sebelum lanjut.
// Penghitung done itu global per peristiwa, dan lifecycle.cycle() mengembalikannya ke nol setiap
// kali dipanggil — tanpa memeriksa apakah cycle sebelumnya sudah selesai.
//
// Jadi bila satu navigasi dimulai saat navigasi lain masih berjalan (tekan kembali dua kali cepat,
// atau menekan kembali tepat saat transisi maju belum rampung), penghitungnya jadi tidak sinkron:
// callback cycle pertama memanggil done() untuk hitungan yang sudah di-reset, tahap berikutnya
// tidak pernah dianggap lengkap, dan cycle-nya berhenti di tengah. Akibatnya .site-loader — lapisan
// penuh layar berwarna krem — tidak pernah disembunyikan lagi dan kelas is-blocked tidak pernah
// dilepas: halaman tampak kosong sama sekali sampai pengguna me-refresh. Isinya sebenarnya ada di
// DOM, hanya tertutup.
//
// Penjaga ini tidak menambal pustakanya. Ia hanya menolak memulai cycle transisi kedua di atas yang
// pertama: navigasi yang datang saat transisi masih jalan dilayani sebagai navigasi peramban biasa
// ke alamat yang sama. Animasinya hilang untuk satu perpindahan itu, tetapi isinya dijamin cocok
// dengan alamat di bilah URL. Ada pula batas waktu sebagai jaring terakhir, kalau-kalau ada cycle
// yang tersendat karena sebab lain (tab dibekukan, rAF dihentikan) — halaman kosong permanen tidak
// pernah menjadi keadaan akhir.

interface LugeLifecycle {
  add(event: string, callback: (done: () => void) => void, position?: number, cycle?: string | null): void;
  _cycle(name: string): void;
}
interface LugeGlobal {
  lifecycle: LugeLifecycle;
  transition?: { getNewUrl?: () => string };
}

// Transisi yang sehat selesai jauh di bawah ini; angkanya sengaja longgar supaya jaring pengaman
// tidak pernah memotong transisi yang sebenarnya masih berjalan di perangkat lambat.
const BATAS_TERSENDAT = 8000;

function pasang(luge: LugeGlobal) {
  const lifecycle = luge.lifecycle;
  if (!lifecycle || (lifecycle as { __dijaga?: boolean }).__dijaga) return;
  (lifecycle as { __dijaga?: boolean }).__dijaga = true;

  let sedangBerjalan = false;
  let penghitungWaktu: ReturnType<typeof setTimeout> | null = null;

  const tujuan = () => {
    const url = luge.transition && luge.transition.getNewUrl && luge.transition.getNewUrl();
    return url || window.location.href;
  };

  const selesai = () => {
    sedangBerjalan = false;
    if (penghitungWaktu !== null) {
      clearTimeout(penghitungWaktu);
      penghitungWaktu = null;
    }
  };

  // `reveal` adalah tahap terakhir cycle transisi. Callback di sini harus memanggil done()-nya
  // sendiri, kalau tidak justru penjaganya yang menahan cycle.
  lifecycle.add(
    "reveal",
    (done) => {
      selesai();
      done();
    },
    999
  );

  const cycleAsli = lifecycle._cycle.bind(lifecycle);
  lifecycle._cycle = function (name: string) {
    if (name !== "transition") return cycleAsli(name);

    if (sedangBerjalan) {
      window.location.href = tujuan();
      return;
    }

    sedangBerjalan = true;
    if (penghitungWaktu !== null) clearTimeout(penghitungWaktu);
    penghitungWaktu = setTimeout(() => {
      if (!sedangBerjalan) return;
      selesai();
      window.location.href = tujuan();
    }, BATAS_TERSENDAT);

    return cycleAsli(name);
  };
}

// Bundel tema dimuat sebagai skrip klasik sebelum modul ini, tetapi instans luge-nya dibuat di
// dalamnya pada waktu yang tidak dijanjikan. Jadi tunggu sampai ada, dengan batas supaya tidak
// menjajaki selamanya bila temanya tidak dimuat sama sekali.
let percobaan = 0;
function tunggu() {
  const luge = (window as unknown as { luge?: LugeGlobal }).luge;
  if (luge && luge.lifecycle) {
    pasang(luge);
    return;
  }
  if (percobaan++ > 200) return;
  setTimeout(tunggu, 50);
}
tunggu();
