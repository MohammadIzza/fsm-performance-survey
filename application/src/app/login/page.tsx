import { redirect } from 'next/navigation';
import { getCurrentAuthContext } from '@/lib/authz';
import { LoginForm } from './login-form';
import { LoginHeroFsm } from './login-hero-fsm';

export default async function LoginPage() {
  if (await getCurrentAuthContext()) redirect('/dashboard');

  return (
    <main className="survey-login">
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
            Masukkan ID terdaftar untuk membuka ruang penilaian Anda.
          </p>
        </div>
        <div className="survey-login-panel">
          <LoginForm />
          <div className="survey-demo-accounts">
            <strong>Lingkungan demo · data fiktif</strong>
            <p>
              Login prototipe tanpa kata sandi. Gunakan salah satu ID berikut:
            </p>
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
          </div>
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
