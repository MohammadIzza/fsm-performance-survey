"use client";

import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";

import { useAksi, useAksiLangsung } from "@/components/theme/notifikasi";
import { TombolHapus } from "@/components/theme/tombol-hapus";
import { DaftarJenis, type Jenis } from "@/components/theme/daftar-jenis";
import { deleteUserAction, deleteUserTypeAction, renameUserTypeAction } from "@/lib/actions/admin-hapus";
import { useState } from "react";
import {
  DataList,
  DataRow,
  RowTitle,
  RowField,
  RowPanelDetails,
  RowPanelField,
  RowPanelActions,
} from "@/components/theme/data-list";
import { AdminActionList, AdminAction } from "@/components/theme/admin-actions";
import { StatusPill } from "@/components/theme/status-pill";
import { FilterBar, FilterField } from "@/components/theme/filter-bar";
import { TextInput } from "@/components/theme/form-field";
import {
  createUserAction,
  updateUserAction,
  setUserActiveAction,
  createUserTypeAction,
} from "@/lib/actions/admin-users";
import { grantRoleAction, revokeRoleAction } from "@/lib/actions/admin-roles";
import type { listUsersWithMeta } from "@/lib/services/users";
import { PilihanCari } from "@/components/theme/pilihan-cari";

type UserWithMeta = Awaited<ReturnType<typeof listUsersWithMeta>>[number];
type UserType = { id: string; code: string; name: string };
type Unit = { id: string; code: string; name: string };

export function UserManager({
  users,
  userTypes,
  units,
  daftarJenis,
}: {
  users: UserWithMeta[];
  userTypes: UserType[];
  units: Unit[];
  /** Semua jenis pengguna beserta keterangan pemakaiannya, untuk diubah namanya atau dihapus. */
  daftarJenis: Jenis[];
}) {
  const [createState, createFormAction, createPending] = useAksi(createUserAction, {}, "Pengguna ditambahkan.");
  const [typeState, typeFormAction, typePending] = useAksi(createUserTypeAction, {}, "Jenis pengguna ditambahkan.");
  // Bab 16.2: "Tabel panjang memiliki pencarian, filter, pagination, dan state kosong" — daftar
  // pengguna tumbuh dengan cepat (satu baris per orang di fakultas), jadi pencarian bukan opsional.
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const visibleUsers = term
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(term) ||
          u.loginIdentifier.toLowerCase().includes(term) ||
          u.email?.toLowerCase().includes(term) ||
          u.primaryUnit?.name.toLowerCase().includes(term) ||
          u.userType.name.toLowerCase().includes(term)
      )
    : users;

  return (
    <div className="space-y-6">
      <AdminActionList>
        <AdminAction
          name="Tambah pengguna"
          description="Identitas baru yang langsung dapat masuk dan menerima tugas."
        >
        <form action={createFormAction} className="grid gap-3 sm:grid-cols-4">
          <label className="admin-tools__field">
            <span>ID masuk<Info>{KET.idMasuk}</Info></span>
            <input
              name="loginIdentifier"
              placeholder="NIP / NIM / NIK"
              required
              className="form__control"
            />
          </label>
          <label className="admin-tools__field">
            <span>Nama lengkap</span>
            <input name="name" placeholder="Nama lengkap" required className="form__control" />
          </label>
          <label className="admin-tools__field">
            <span>Email (opsional)<Info>{KET.email}</Info></span>
            <input
              name="email"
              type="email"
              placeholder="nama@lecturer.undip.ac.id"
              className="form__control"
            />
          </label>
          <label className="admin-tools__field">
            <span>Kata sandi (opsional)<Info>{KET.kataSandi}</Info></span>
            <input
              name="kataSandi"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder="Min. 8 karakter"
              className="form__control"
            />
          </label>
          <label className="admin-tools__field">
          <span>Jenis pengguna<Info>{KET.jenisPengguna}</Info></span>
          <PilihanCari
            name="userTypeId"
            required
            kosong={{ label: "Jenis pengguna…", bisaDipilih: false }}
            options={userTypes.map((t) => ({ value: t.id, label: t.name }))}
          />
          </label>
          <label className="admin-tools__field">
          <span>Unit utama (opsional)<Info>{KET.unitUtama}</Info></span>
          <PilihanCari
            name="primaryUnitId"
            defaultValue=""
            kosong={{ label: "— Tanpa unit utama —", bisaDipilih: true }}
            options={units.map((u) => ({ value: u.id, label: u.name }))}
          />
          </label>
          <div className="sm:col-span-4">
            {createState.error && (
              <p role="alert" className="mb-2 text-sm text-[var(--danger)]">
                {createState.error}
              </p>
            )}
            <button
              type="submit"
              disabled={createPending}
              className="app-btn app-btn--primary"
            >
              {createPending ? "Menyimpan…" : "Tambah pengguna"}
            </button>
          </div>
        </form>
        </AdminAction>

        <AdminAction
          name="Kelola jenis pengguna"
          description="Daftar jenis yang dapat dipilih saat menambah pengguna."
        >
          <form action={typeFormAction} className="grid gap-3 sm:grid-cols-4">
            <label className="admin-tools__field">
              <span>Nama jenis</span>
              <input name="name" placeholder="mis. Laboran" required className="form__control" />
            </label>
            <div className="sm:col-span-4">
              {typeState.error && (
                <p role="alert" className="mb-2 app-text-sm" style={{ color: "var(--color-brand-1)" }}>
                  {typeState.error}
                </p>
              )}
              <button type="submit" disabled={typePending} className="app-btn app-btn--primary">
                {typePending ? "Menyimpan…" : "Tambah jenis"}
              </button>
            </div>
          </form>
          <DaftarJenis jenis={daftarJenis} aksiUbah={renameUserTypeAction} aksiHapus={deleteUserTypeAction} sebutan="jenis pengguna" />
        </AdminAction>
      </AdminActionList>

      <FilterBar>
        <FilterField label="Cari pengguna" htmlFor="cari-pengguna" wide>
          <TextInput
            id="cari-pengguna"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nama, ID, unit, atau jenis pengguna…"
          />
        </FilterField>
      </FilterBar>

      {visibleUsers.length === 0 ? (
        <div className="app-empty-box">
          <p className="text-[var(--muted)]">
            Tidak ada pengguna yang cocok dengan &ldquo;{search}&rdquo;.
          </p>
        </div>
      ) : (
        <DataList
          columns={[
            ["title", "Pengguna"],
            ["duration", "Jenis"],
            ["location", "Unit utama"],
            ["topic", "Peran"],
            ["dates", "Status"],
            ["price", "Aksi"],
          ]}
        >
          {visibleUsers.map((user) => (
                <UserRow key={user.id} user={user} userTypes={userTypes} units={units} />
              ))}
        </DataList>
      )}
    </div>
  );
}

function UserRow({
  user,
  userTypes,
  units,
}: {
  user: UserWithMeta;
  userTypes: UserType[];
  units: Unit[];
}) {
  const cabutPeran = useAksiLangsung(revokeRoleAction, "Peran dicabut.");
  const ubahAktifPengguna = useAksiLangsung(setUserActiveAction, (fd) => (fd.get("active") === "true" ? "Pengguna diaktifkan." : "Pengguna dinonaktifkan."));
  const [updateState, updateFormAction, updatePending] = useAksi(updateUserAction, {}, "Perubahan pengguna disimpan.");
  const [grantState, grantFormAction, grantPending] = useAksi(grantRoleAction, {}, "Peran diberikan.");

  const rowFields = (
    <>
      <RowTitle>
        {user.name}
        <span className="sb__subtitle">{user.loginIdentifier}</span>
      </RowTitle>
      <RowField kind="duration" icon={false} detail>
        {user.userType.name}
      </RowField>
      <RowField kind="location" icon={false} detail>
        {user.primaryUnit ? user.primaryUnit.name : "\u2014"}
      </RowField>
      <RowField kind="topic" icon={false} detail>
        {user.roleGrants.length === 0 && user.leaderships.length === 0 ? (
          "Pengguna"
        ) : (
          <>
            {user.roleGrants.map((g) => (
              <span key={g.id} className="sb__stack">
                {g.role === "ADMIN" ? "Admin" : "Dekan"}
              </span>
            ))}
            {user.leaderships.map((l) => (
              <span key={l.id} className="sb__stack">
                {l.title}
                <span className="sb__subtitle">{l.unit.name}</span>
              </span>
            ))}
          </>
        )}
      </RowField>
      <RowField kind="dates" icon={false}>
        <StatusPill tone={user.active ? "selesai" : "netral"}>
          {user.active ? "Aktif" : "Nonaktif"}
        </StatusPill>
      </RowField>
    </>
  );

  // Form sunting dan panel peran dulu menempati satu <tr> tambahan ber-colSpan; sekarang jadi
  // panel di dalam <li> yang sama, dengan barisnya tetap terlihat selama disunting.
  return (
    <DataRow
      collapsible
      panel={
        <div className="admin-row-panel">
          <RowPanelDetails>
            <RowPanelField label="ID pengguna">{user.loginIdentifier}</RowPanelField>
            <RowPanelField label="Email">{user.email ?? "—"}</RowPanelField>
            <RowPanelField label="Cara masuk">
              {user.adaKataSandi ? "SSO atau email/ID + kata sandi" : "SSO"}
            </RowPanelField>
            <RowPanelField label="Jenis">{user.userType.name}</RowPanelField>
            <RowPanelField label="Unit utama">
              {user.primaryUnit ? user.primaryUnit.name : "—"}
            </RowPanelField>
            <RowPanelField label="Peran">
              {user.roleGrants.length === 0 && user.leaderships.length === 0 ? (
                "Pengguna"
              ) : (
                <>
                  {user.roleGrants.map((grant) => (
                    <span key={grant.id} className="sb__stack">
                      {grant.role === "ADMIN" ? "Admin" : "Dekan"}
                    </span>
                  ))}
                  {user.leaderships.map((leadership) => (
                    <span key={leadership.id} className="sb__stack">
                      {leadership.title}
                      <span className="sb__subtitle">{leadership.unit.name}</span>
                    </span>
                  ))}
                </>
              )}
            </RowPanelField>
            <RowPanelField label="Status">
              <StatusPill tone={user.active ? "selesai" : "netral"}>
                {user.active ? "Aktif" : "Nonaktif"}
              </StatusPill>
            </RowPanelField>
          </RowPanelDetails>

          <section className="admin-row-section">
          <h3 className="app-panel__label app-panel__label--tight">Ubah pengguna</h3>
          <form action={updateFormAction} className="admin-inline-form grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="userId" value={user.id} />
            <label className="admin-tools__field">
              <span>ID masuk<Info>{KET.idMasuk}</Info></span>
              <input
                name="loginIdentifier"
                defaultValue={user.loginIdentifier}
                required
                className="form__control"
              />
            </label>
            <label className="admin-tools__field">
              <span>Nama lengkap</span>
              <input name="name" defaultValue={user.name} required className="form__control" />
            </label>
            <label className="admin-tools__field">
              <span>Email<Info>{KET.email}</Info></span>
              <input
                name="email"
                type="email"
                defaultValue={user.email ?? ""}
                placeholder="nama@lecturer.undip.ac.id"
                className="form__control"
              />
            </label>
            <label className="admin-tools__field">
              <span>
                {user.adaKataSandi ? "Kata sandi baru" : "Beri kata sandi"}
                <Info>{KET.kataSandi}</Info>
              </span>
              <input
                name="kataSandi"
                type="password"
                autoComplete="new-password"
                minLength={8}
                placeholder={user.adaKataSandi ? "Kosongkan bila tidak diganti" : "Min. 8 karakter"}
                className="form__control"
              />
              {user.adaKataSandi && (
                <span className="admin-tools__check">
                  <input type="checkbox" name="hapusKataSandi" /> Cabut kata sandi (hanya SSO)
                </span>
              )}
            </label>
            <label className="admin-tools__field">
              <span>Jenis pengguna<Info>{KET.jenisPengguna}</Info></span>
              <PilihanCari
                name="userTypeId"
                defaultValue={user.userTypeId}
                required
                options={userTypes.map((t) => ({ value: t.id, label: t.name }))}
              />
            </label>
            <label className="admin-tools__field">
              <span>Unit utama<Info>{KET.unitUtama}</Info></span>
              <PilihanCari
                name="primaryUnitId"
                defaultValue={user.primaryUnitId ?? ""}
                kosong={{ label: "— Tanpa unit utama —", bisaDipilih: true }}
                options={units.map((u) => ({ value: u.id, label: u.name }))}
              />
            </label>
            <div className="flex items-center gap-2 sm:col-span-4">
              <button
                type="submit"
                disabled={updatePending}
                className="app-btn app-btn--primary"
              >
                {updatePending ? "Menyimpan…" : "Simpan"}
              </button>
              {updateState.error && (
                <p role="alert" className="app-text-sm" style={{ color: "var(--color-brand-1)" }}>
                  {updateState.error}
                </p>
              )}
            </div>
          </form>
          </section>

          <section className="admin-row-section">
          <h3 className="app-panel__label app-panel__label--tight">Peran sistem</h3>
          <div className="space-y-3">
              <p className="app-text-xs" style={{ color: "var(--color-text)" }}>
                Peran sistem berlaku di luar jenis pengguna: Admin mengelola seluruh aplikasi,
                Dekan membaca hasil seluruh fakultas.
              </p>
              {user.roleGrants.length === 0 ? (
                <p className="app-text-sm">Belum memegang peran sistem.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {user.roleGrants.map((g) => (
                    <li
                      key={g.id}
                      className="flex items-center gap-2 admin-row-list__item app-text-sm"
                    >
                      <span className="font-medium text-[var(--foreground)]">
                        {g.role === "ADMIN" ? "Admin" : "Dekan"}
                      </span>
                      <form action={cabutPeran}>
                        <input type="hidden" name="grantId" value={g.id} />
                        <button
                          type="submit"
                          className="app-text-xs font-medium text-[var(--muted)] hover:text-[var(--danger)] hover:underline"
                        >
                          Cabut
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}

              <form action={grantFormAction} className="admin-inline-form grid gap-3 sm:grid-cols-4">
                <input type="hidden" name="userId" value={user.id} />
                <label className="admin-tools__field">
                  <span>Beri peran<Info>{KET.peran}</Info></span>
                  {/* Tanpa pilihan kosong di depan, kotak ini selalu memperlihatkan "Admin" —
                      nilai pertama daftarnya — dan pada tiap pengguna terbaca seolah menyatakan
                      peran yang dipegangnya, bukan peran yang hendak diberikan. */}
                  <select name="role" required defaultValue="" className="form__control">
                    <option value="" disabled>
                      Pilih peran…
                    </option>
                    <option value="ADMIN">Admin</option>
                    <option value="DEKAN">Dekan</option>
                  </select>
                </label>
                <div className="flex flex-wrap items-center gap-2 self-end sm:col-span-3">
                  <button
                    type="submit"
                    disabled={grantPending}
                    className="app-btn app-btn--primary"
                  >
                    {grantPending ? "Menyimpan…" : "Tetapkan"}
                  </button>
                  {grantState.error && (
                    <p role="alert" className="app-text-sm" style={{ color: "var(--color-brand-1)" }}>
                      {grantState.error}
                    </p>
                  )}
                </div>
              </form>
            </div>
          </section>

          <RowPanelActions>
            <form action={ubahAktifPengguna}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="active" value={(!user.active).toString()} />
              <button type="submit" className="app-btn">
                {user.active ? "Nonaktifkan pengguna" : "Aktifkan pengguna"}
              </button>
            </form>
            <TombolHapus
              aksi={deleteUserAction}
              id={user.id}
              label="Hapus pengguna"
              judul={`Hapus ${user.name}?`}
              pesan={<p>Pengguna hanya bisa dihapus bila belum pernah punya tugas, jawaban, jabatan, atau objek penilaian. Bila sudah, nonaktifkan saja agar tidak bisa masuk.</p>}
              berhasil="Pengguna dihapus."
            />
          </RowPanelActions>
        </div>
      }
    >
      {rowFields}
    </DataRow>
  );
}
