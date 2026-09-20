/**
 * Saklar untuk login ID tanpa kata sandi — peninggalan prototipe (Bab 5.2: "Login prototipe tanpa
 * kata sandi") yang memasukkan siapa pun yang mengetik id_login milik orang lain.
 *
 * Aman selama datanya fiktif, berbahaya begitu aplikasi memegang data pengguna sungguhan: NIP dan
 * NIM bukan rahasia. Di produksi saklar ini dibiarkan mati sehingga hanya SSO yang bisa masuk;
 * nyalakan (LOGIN_ID_DEMO=1) hanya di lingkungan uji, atau sementara di produksi bila SSO sedang
 * bermasalah dan admin butuh jalan masuk.
 *
 * Hanya dibaca di sisi server (halaman login dan loginAction) — jangan diimpor dari komponen
 * klien, karena variabel tanpa awalan NEXT_PUBLIC_ tidak tersedia di peramban.
 */
export const LOGIN_ID_AKTIF = process.env.LOGIN_ID_DEMO === "1";
