"use client";

import { useActionState, useState } from "react";
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

type UserWithMeta = Awaited<ReturnType<typeof listUsersWithMeta>>[number];
type UserType = { id: string; code: string; name: string };
type Unit = { id: string; code: string; name: string };

export function UserManager({
  users,
  userTypes,
  units,
}: {
  users: UserWithMeta[];
  userTypes: UserType[];
  units: Unit[];
}) {
  const [createState, createFormAction, createPending] = useActionState(createUserAction, {});
  const [typeState, typeFormAction, typePending] = useActionState(createUserTypeAction, {});
  // Bab 16.2: "Tabel panjang memiliki pencarian, filter, pagination, dan state kosong" — daftar
  // pengguna tumbuh dengan cepat (satu baris per orang di fakultas), jadi pencarian bukan opsional.
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const visibleUsers = term
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(term) ||
          u.loginIdentifier.toLowerCase().includes(term) ||
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
          <input
            name="loginIdentifier"
            placeholder="ID (NIP/NIM/NIK)"
            required
            className="form__control"
          />
          <input
            name="name"
            placeholder="Nama lengkap"
            required
            className="form__control"
          />
          <select
            name="userTypeId"
            required
            defaultValue=""
            className="form__control"
          >
            <option value="" disabled>
              Jenis pengguna…
            </option>
            {userTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            name="primaryUnitId"
            defaultValue=""
            className="form__control"
          >
            <option value="">— Unit utama (opsional) —</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.code})
              </option>
            ))}
          </select>
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
            <input name="code" placeholder="Kode (mis. LABORAN)" required className="form__control" />
            <input name="name" placeholder="Nama (mis. Laboran)" required className="form__control" />
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
  const [updateState, updateFormAction, updatePending] = useActionState(updateUserAction, {});
  const [grantState, grantFormAction, grantPending] = useActionState(grantRoleAction, {});

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
                <span className="sb__subtitle">{l.unit.code}</span>
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
                      <span className="sb__subtitle">{leadership.unit.code}</span>
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
            <input
              name="loginIdentifier"
              defaultValue={user.loginIdentifier}
              required
              className="form__control"
            />
            <input
              name="name"
              defaultValue={user.name}
              required
              className="form__control"
            />
            <select
              name="userTypeId"
              defaultValue={user.userTypeId}
              required
              className="form__control"
            >
              {userTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              name="primaryUnitId"
              defaultValue={user.primaryUnitId ?? ""}
              className="form__control"
            >
              <option value="">— Tanpa unit utama —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
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
              {user.roleGrants.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {user.roleGrants.map((g) => (
                    <li
                      key={g.id}
                      className="flex items-center gap-2 admin-row-list__item app-text-sm"
                    >
                      <span className="font-medium text-[var(--foreground)]">
                        {g.role === "ADMIN" ? "Admin" : "Dekan"}
                      </span>
                      <form action={revokeRoleAction}>
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
                  <span>Beri peran</span>
                  <select name="role" defaultValue="ADMIN" className="form__control">
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
            <form action={setUserActiveAction}>
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="active" value={(!user.active).toString()} />
              <button type="submit" className="app-btn">
                {user.active ? "Nonaktifkan pengguna" : "Aktifkan pengguna"}
              </button>
            </form>
          </RowPanelActions>
        </div>
      }
    >
      {rowFields}
    </DataRow>
  );
}
