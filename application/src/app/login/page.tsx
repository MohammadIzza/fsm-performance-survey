import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/authz";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
 if(await getCurrentAuthContext()) redirect("/dashboard");
 return <main className="survey-login">
  <section className="survey-login-art">
   <h1>Penilaian baik.<br/>Bertumbuh<br/>bersama.</h1>
   <p className="mt-6 max-w-md text-lg">Satu ruang untuk penilaian yang terarah, transparan, dan bermakna bagi FSM UNDIP.</p>
   {/* Kolase balok warna brand dan bintang tema — bentuk yang sama dipakai seksi sorotan di
       halaman publik. Semuanya bentuk datar dari palet yang ada, jadi tidak ada aset baru dan
       tidak ada yang perlu diunduh. */}
   <div className="survey-login-collage" aria-hidden="true">
    <span className="survey-login-collage__bar"/>
    <span className="survey-login-collage__square"/>
    <span className="survey-login-collage__bubble"/>
    <img src="/assets/images/asset-star-1.svg" alt="" width="72" height="72" className="survey-login-collage__star"/>
   </div>
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
  <div className="survey-login-hills" aria-hidden="true">
   <span/><span/><span/><span/><span/>
   <i/>
  </div>
 </main>;
}
