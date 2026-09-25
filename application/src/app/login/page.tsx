import { redirect } from 'next/navigation';
import { withBase } from '@/lib/base-path';
import { getCurrentAuthContext } from '@/lib/authz';
import { LoginForm } from './login-form';
import { LoginHeroFsm } from './login-hero-fsm';
import { DaftarAkunDemo } from './daftar-akun';
import { getDemoAccountDirectory } from '@/lib/services/demoAccounts';
import { SsoLoginButton } from './sso-login-button';
import { SandiForm } from './sandi-form';
import { LOGIN_ID_AKTIF } from '@/lib/login-id';

export default async function LoginPage() {
  if (await getCurrentAuthContext()) redirect('/dashboard');

  // Direktori lengkap hanya untuk lingkungan uji berdata fiktif (v2/UAT). Tanpa penanda ini
  // halaman kembali ke empat ID contoh, supaya penggabungan ke aplikasi berpengguna sungguhan
  // tidak ikut membeberkan seluruh ID di halaman yang bisa dibuka siapa saja.
  const direktori =
    LOGIN_ID_AKTIF && process.env.DAFTAR_AKUN_DEMO === '1' ? await getDemoAccountDirectory() : null;

  return (
    <main className="survey-login">
      {/* Huruf FSM: di layar lebar JSON animasinya diminta sejak HTML diterima (bukan menunggu
          pustaka Lottie termuat); di ponsel yang dipakai gambar statisnya. `media` membuat
          masing-masing hanya diunduh pada lebar layar yang memakainya. React memindahkan <link>
          ini ke <head>. */}
      {['f', 's', 'm'].map((huruf) => (
        <link
          key={`json-${huruf}`}
          rel="preload"
          as="fetch"
          crossOrigin="anonymous"
          href={withBase(`/assets/lottie/home-hero-${huruf}.json`)}
          media="(min-width: 641px) and (prefers-reduced-motion: no-preference)"
        />
      ))}
      {['f', 's', 'm'].map((huruf) => (
        <link
          key={`svg-${huruf}`}
          rel="preload"
          as="image"
          href={withBase(`/assets/images/login-fsm-${huruf}.svg`)}
          media="(max-width: 640px), (prefers-reduced-motion: reduce)"
        />
      ))}
      <section className="survey-login-art">
        <LoginHeroFsm />
      </section>

      <section className="survey-login-form">
        {/* Dua pembungkus ini hanya berlaku di ponsel: judul berdiri di atas bidang warna, lalu
            isian dan akun demo turun ke kartu putih di bawahnya. Di layar lebar keduanya dibuat
            `display:contents` sehingga hilang dari tata letak dan kolom kanan tetap satu aliran. */}
        <div className="survey-login-intro">
          {/* Kelas skala tema dipakai langsung di markahnya, sama seperti judul dan teks seksi di
              situs publik — ukurannya jadi satu sumber, bukan angka yang ditulis ulang di sini. */}
          <p className="eyebrow">Survei Penilaian · FSM UNDIP</p>
          <h2 className="t-h-4xs">
            Selamat datang
            <br />
            kembali.
          </h2>
          <p className="survey-login-form__text t-t-md">
            {LOGIN_ID_AKTIF
              ? 'Masukkan ID terdaftar untuk membuka ruang survei Anda.'
              : 'Masuk dengan akun UNDIP Anda, atau dengan akun yang diberikan admin.'}
          </p>
        </div>
        {/* Kartu putih hanya untuk formulir ID darurat. Tombol SSO dan isian kata sandi berdiri
            langsung di atas kuning: tombol birunya lebih menonjol di sana, dan isiannya diberi
            bidang putih sendiri supaya tempat mengetik tetap jelas. */}
        <div className={`survey-login-panel${LOGIN_ID_AKTIF ? ' survey-login-panel--kartu' : ''}`}>
          <SsoLoginButton />
          {/* Akun berkata sandi dibuatkan admin untuk orang tanpa akun UNDIP. */}
          <div className="survey-login-divider" role="separator">
            <span>atau dengan akun dari admin</span>
          </div>
          <SandiForm />
          {/* Masuk dengan ID tanpa kata sandi hanya ada bila saklarnya dinyalakan (lib/login-id.ts).
              Penolakan sesungguhnya ada di loginAction; bagian ini sekadar tidak menawarkannya. */}
          {LOGIN_ID_AKTIF && (
            <>
              <div className="survey-login-divider" role="separator">
                <span>atau</span>
              </div>
              <LoginForm />
              <div className={`survey-demo-accounts${direktori ? ' survey-demo-accounts--lengkap' : ''}`}>
                <strong>Lingkungan demo · data fiktif</strong>
                <p>
                  Login prototipe tanpa kata sandi.{' '}
                  {direktori
                    ? 'Pilih akun per unit di bawah; menekan ID mengisikannya ke kolom di atas.'
                    : 'Gunakan salah satu ID berikut:'}
                </p>
                {direktori ? (
                  <DaftarAkunDemo direktori={direktori} />
                ) : (
                  <dl>
                    <dt>Admin</dt>
                    <dd>
                      <code>admin01</code>
                    </dd>
                    <dt>Dekan</dt>
                    <dd>
                      <code>dekan01</code>
                    </dd>
                    <dt>Pimpinan</dt>
                    <dd>
                      <code>dosen1001</code>
                    </dd>
                    <dt>Penilai</dt>
                    <dd>
                      <code>dosen1004</code>
                    </dd>
                  </dl>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <div className="survey-login-hills" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <i />
      </div>
    </main>
  );
}
