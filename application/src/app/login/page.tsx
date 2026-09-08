import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/authz";
import { LoginForm } from "./login-form";
import { ThemeMotion } from "@/components/theme-motion";

export default async function LoginPage() {
 if(await getCurrentAuthContext()) redirect("/dashboard");
 return <main className="survey-login">
  <section className="survey-login-art">
   <h1>Penilaian baik.<br/>Bertumbuh<br/>bersama.</h1>
   <ThemeMotion />
   <p className="mt-6 max-w-md text-lg">Satu ruang untuk penilaian yang terarah, transparan, dan bermakna bagi FSM UNDIP.</p>
  </section>
  <section className="survey-login-form">
   <p className="eyebrow">SURVEI PENILAIAN · FSM UNDIP</p>
   <h2>Selamat datang<br/>kembali.</h2>
   <p className="mb-8 text-[var(--muted)]">Masukkan ID terdaftar untuk membuka ruang penilaian Anda.</p>
   <LoginForm />
   <div className="survey-demo-accounts"><strong>Lingkungan demo · data fiktif</strong><p className="mt-2">Login prototipe tanpa kata sandi. Gunakan salah satu ID berikut:</p>
    <dl><dt>Admin</dt><dd><code>admin01</code></dd><dt>Dekan</dt><dd><code>dekan01</code></dd><dt>Pimpinan</dt><dd><code>dosen1001</code></dd><dt>Penilai</dt><dd><code>dosen1004</code></dd></dl>
   </div>
  </section>
 </main>;
}
