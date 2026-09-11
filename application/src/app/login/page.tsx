import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/authz";
import { LoginForm } from "./login-form";
import { LoginHeroFsm } from "./login-hero-fsm";

export default async function LoginPage() {
  if (await getCurrentAuthContext()) redirect("/dashboard");

  return (
    <main className="survey-login">
      <section className="survey-login-art">
        <h1>
          Penilaian baik.
          <br />
          Bertumbuh bersama.
        </h1>
        <p className="survey-login-art__text">
          Satu ruang untuk penilaian yang terarah, transparan, dan bermakna bagi FSM UNDIP.
        </p>
        <LoginHeroFsm />
      </section>

      <section className="survey-login-form">
        <p className="eyebrow">Survei Penilaian · FSM UNDIP</p>
        <h2>
          Selamat datang
          <br />
          kembali.
        </h2>
        <p className="survey-login-form__text">
          Masukkan ID terdaftar untuk membuka ruang penilaian Anda.
        </p>
        <LoginForm />
        <div className="survey-demo-accounts">
          <strong>Lingkungan demo · data fiktif</strong>
          <p>Login prototipe tanpa kata sandi. Gunakan salah satu ID berikut:</p>
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
