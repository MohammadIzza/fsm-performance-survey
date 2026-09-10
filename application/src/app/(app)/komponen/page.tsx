import { getCurrentAuthContext } from "@/lib/authz";
import { DataList, DataRow, RowTitle, RowField } from "@/components/theme/data-list";
import { UspGrid, UspCard } from "@/components/theme/usp-grid";
import { Disclosure, DisclosureGroup } from "@/components/theme/disclosure";
import { Form, Field, FormActions, TextInput, Select } from "@/components/theme/form-field";
import { SectionHeader } from "@/components/theme/section-header";
import { ThemeButton } from "@/components/theme-button";

/**
 * Halaman pembanding komponen bersama, khusus Admin. Dibuat untuk satu keperluan: menaruh tiap
 * komponen yang dipakai ulang dari halaman referensi berdampingan dengan catatan kelas tema
 * asalnya, supaya bisa dinilai apakah sudah sama dengan situs publik sebelum halaman-halaman
 * sungguhan ditulis ulang. Aman dihapus setelah itu.
 */
export default async function KomponenPage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx?.isAdmin) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-[15px] font-medium">Tidak berwenang</p>
      </div>
    );
  }

  return (
    <div className="u-container" style={{ display: "grid", gap: "4rem" }}>
      <div>
        <p className="eyebrow">PEMBANDING KOMPONEN</p>
        <h1 className="t-h-sm" style={{ marginTop: ".25rem" }}>
          Komponen bersama, diambil dari halaman referensi.
        </h1>
        <p className="t-t-sm" style={{ marginTop: ".75rem", maxWidth: "42em" }}>
          Tiap blok di bawah memakai kelas tema aslinya, bukan tiruan. Nama kelasnya disebut supaya
          bisa dicocokkan langsung dengan halaman panduan dan beranda.
        </p>
      </div>

      <section>
        <p className="t-t-sm" style={{ color: "var(--color-brand-1)" }}>
          <code>.s-courses-list</code> + <code>.sb-course</code> — sama dengan daftar kategori di
          beranda
        </p>
        <DataList
          title="Tugas Saya"
          intro="Daftar penilaian yang perlu Anda isi."
          headerAction={<ThemeButton size="sm">Unduh Excel</ThemeButton>}
        >
          <DataRow href="/komponen" accent="green">
            <RowTitle accent="green">Dr. Dosen Matematika B</RowTitle>
            <RowField kind="dates">31 Agu 2026</RowField>
            <RowField kind="duration">Selain Pimpinan</RowField>
            <RowField kind="location">Departemen Matematika</RowField>
          </DataRow>
          <DataRow href="/komponen" accent="pink">
            <RowTitle accent="pink">Dr. Dosen Fisika A</RowTitle>
            <RowField kind="dates">31 Agu 2026</RowField>
            <RowField kind="duration">Pimpinan</RowField>
            <RowField kind="location">Departemen Fisika</RowField>
          </DataRow>
        </DataList>
      </section>

      <section>
        <p className="t-t-sm" style={{ color: "var(--color-brand-1)" }}>
          <code>.s-usps</code> + <code>.sb-usp</code> — sama dengan “Yang perlu Anda ketahui” di
          panduan penilai. Lebar kartu dari sistem kolom tema.
        </p>
        <UspGrid title="Ringkasan" intro="Kartu memakai lebar kolom tema.">
          <UspCard title="Tugas Saya" tone="kuning" lottie="usp-python">
            Empat penilaian, satu masih menanti pengisian.
          </UspCard>
          <UspCard title="Lingkup Akses" tone="merah" lottie="usp-sql">
            Akses penuh seluruh fakultas sebagai Admin.
          </UspCard>
          <UspCard title="Periode Aktif" tone="biru">
            Penilaian Kinerja Semester Ganjil 2026.
          </UspCard>
        </UspGrid>
      </section>

      <section>
        <p className="t-t-sm" style={{ color: "var(--color-brand-1)" }}>
          <code>.s-faq</code> + <code>.sb-question</code> — sama dengan tanya-jawab di panduan
        </p>
        <DisclosureGroup>
          <Disclosure question="Apa yang terjadi kalau draf tidak dikirim?" defaultOpen>
            Draf tidak pernah ikut dihitung. Selama periode masih aktif, draf boleh disimpan berapa
            kali pun dan baru berlaku setelah dikirim.
          </Disclosure>
          <Disclosure question="Bisakah jawaban diubah setelah dikirim?" accent="pink">
            Bisa, bila admin membuka kembali tugas tersebut. Jawaban lama tetap tersimpan sampai
            revisi baru dikirim.
          </Disclosure>
        </DisclosureGroup>
      </section>

      <section>
        <p className="t-t-sm" style={{ color: "var(--color-brand-1)" }}>
          <code>.form</code> + <code>.form__control</code> — sama dengan formulir di panduan
        </p>
        <SectionHeader title="Saring daftar" size="t-h-2xs" />
        <Form>
          <Field label="Periode" htmlFor="demo-periode">
            <Select id="demo-periode" name="periode" defaultValue="">
              <option value="">Semua periode</option>
              <option value="1">Penilaian Kinerja Semester Ganjil 2026</option>
            </Select>
          </Field>
          <Field label="Kata kunci" htmlFor="demo-cari" hint="Mencari pada nama objek dan unit.">
            <TextInput id="demo-cari" name="cari" placeholder="mis. Matematika" />
          </Field>
          <FormActions>
            <ThemeButton type="button">Terapkan</ThemeButton>
          </FormActions>
        </Form>
      </section>
    </div>
  );
}
