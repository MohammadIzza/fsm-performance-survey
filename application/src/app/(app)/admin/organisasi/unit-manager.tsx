"use client";

import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";

import { useAksi, useAksiLangsung } from "@/components/theme/notifikasi";
import { TombolHapus } from "@/components/theme/tombol-hapus";
import { deleteUnitAction } from "@/lib/actions/admin-hapus";
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
import { createUnitAction, updateUnitAction, setUnitActiveAction } from "@/lib/actions/admin-units";
import { assignLeadershipAction, endLeadershipAction } from "@/lib/actions/admin-leadership";
import type { listUnitsWithMeta } from "@/lib/services/units";
import { PilihanCari } from "@/components/theme/pilihan-cari";

type UnitWithMeta = Awaited<ReturnType<typeof listUnitsWithMeta>>[number];
type ActiveUser = { id: string; name: string; loginIdentifier: string };

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });

function unitLabel(u: { name: string }) {
  return u.name;
}

export function UnitManager({
  units,
  activeUsers,
}: {
  units: UnitWithMeta[];
  activeUsers: ActiveUser[];
}) {
  const [createState, createFormAction, createPending] = useAksi(createUnitAction, {}, "Unit ditambahkan.");
  const parentOptions = units.filter((u) => u.active);

  return (
    <div className="space-y-6">
      <AdminActionList>
        <AdminAction
          name="Tambah unit"
          description="Menambah satu unit baru ke pohon organisasi."
        >
        <form action={createFormAction} className="admin-inline-form grid gap-3 sm:grid-cols-4">
          <label className="admin-tools__field sm:col-span-3">
            <span>Nama unit</span>
            <input name="name" placeholder="Nama unit" required className="form__control" />
          </label>
          <label className="admin-tools__field">
          <span>Induk<Info>{KET.induk}</Info></span>
          <PilihanCari
            name="parentId"
            defaultValue=""
            kosong={{ label: "— Akar (tanpa induk) —", bisaDipilih: true }}
            options={parentOptions.map((u) => ({ value: u.id, label: unitLabel(u) }))}
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
              {createPending ? "Menyimpan…" : "Tambah unit"}
            </button>
          </div>
        </form>
        </AdminAction>
      </AdminActionList>

      <DataList
        columns={[
          ["title", "Unit"],
          ["duration", "Induk"],
          ["location", "Pimpinan aktif"],
          ["dates", "Status"],
          ["price", "Aksi"],
        ]}
      >
        {units.map((unit) => (
          <UnitRow key={unit.id} unit={unit} allUnits={units} activeUsers={activeUsers} />
        ))}
      </DataList>
    </div>
  );
}

function UnitRow({
  unit,
  allUnits,
  activeUsers,
}: {
  unit: UnitWithMeta;
  allUnits: UnitWithMeta[];
  activeUsers: ActiveUser[];
}) {
  const akhiriJabatan = useAksiLangsung(endLeadershipAction, "Masa jabatan diakhiri.");
  const ubahAktifUnit = useAksiLangsung(setUnitActiveAction, (fd) => (fd.get("active") === "true" ? "Unit diaktifkan." : "Unit dinonaktifkan."));
  const [updateState, updateFormAction, updatePending] = useAksi(updateUnitAction, {}, "Perubahan unit disimpan.");
  const [assignState, assignFormAction, assignPending] = useAksi(assignLeadershipAction, {}, "Pimpinan unit ditetapkan.");

  const parent = allUnits.find((u) => u.id === unit.parentId);
  const parentOptions = allUnits.filter((u) => u.id !== unit.id && u.active);

  const rowFields = (
    <>
      <RowTitle>
        {unit.name}
      </RowTitle>
      <RowField kind="duration" icon={false} detail>
        {parent ? parent.name : "\u2014"}
      </RowField>
      <RowField kind="location" icon={false} detail>
        {unit.currentLeaders.length === 0 ? (
          "Belum ada pimpinan"
        ) : (
          <>
            {unit.currentLeaders.map((l) => (
              <span key={l.id} className="sb__stack">
                {l.user.name}
                <span className="sb__subtitle">{l.title}</span>
              </span>
            ))}
          </>
        )}
      </RowField>
      <RowField kind="dates" icon={false}>
        <StatusPill tone={unit.active ? "selesai" : "netral"}>
          {unit.active ? "Aktif" : "Nonaktif"}
        </StatusPill>
      </RowField>
    </>
  );

  // Form sunting dan panel pimpinan dulu menempati satu <tr> tambahan ber-colSpan di bawah
  // barisnya. Sekarang keduanya jadi panel di dalam <li> yang sama; barisnya tetap terlihat
  // selama disunting, jadi jelas unit mana yang sedang diubah.
  return (
    <DataRow
      collapsible
      panel={
        <div className="admin-row-panel">
          <RowPanelDetails>
            <RowPanelField label="Induk">{parent ? parent.name : "—"}</RowPanelField>
            <RowPanelField label="Pimpinan aktif">
              {unit.currentLeaders.length === 0
                ? "Belum ada pimpinan"
                : unit.currentLeaders.map((leader) => (
                    <span key={leader.id} className="sb__stack">
                      {leader.user.name}
                      <span className="sb__subtitle">{leader.title}</span>
                    </span>
                  ))}
            </RowPanelField>
            <RowPanelField label="Status">
              <StatusPill tone={unit.active ? "selesai" : "netral"}>
                {unit.active ? "Aktif" : "Nonaktif"}
              </StatusPill>
            </RowPanelField>
          </RowPanelDetails>

          <section className="admin-row-section">
          <h3 className="app-panel__label app-panel__label--tight">Ubah unit</h3>
          <form action={updateFormAction} className="admin-inline-form grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="unitId" value={unit.id} />
            <label className="admin-tools__field sm:col-span-3">
              <span>Nama unit</span>
              <input name="name" defaultValue={unit.name} required className="form__control" />
            </label>
            <label className="admin-tools__field">
            <span>Induk<Info>{KET.induk}</Info></span>
            <PilihanCari
              name="parentId"
              defaultValue={unit.parentId ?? ""}
              kosong={{ label: "— Akar (tanpa induk) —", bisaDipilih: true }}
              options={parentOptions.map((u) => ({ value: u.id, label: unitLabel(u) }))}
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
          <h3 className="app-panel__label app-panel__label--tight">Pimpinan</h3>
          <div className="space-y-4">
              {unit.leaderships.length > 0 && (
                <ul className="space-y-1.5">
                  {unit.leaderships.map((l) => {
                    const isCurrent = unit.currentLeaders.some((c) => c.id === l.id);
                    return (
                      <li
                        key={l.id}
                        className="flex items-center justify-between admin-row-list__item app-text-sm"
                      >
                        <span>
                          <span className="font-medium text-[var(--foreground)]">
                            {l.user.name}
                          </span>{" "}
                          <span className="text-[var(--muted)]">
                            — {l.title} · sejak {dateFmt.format(new Date(l.effectiveFrom))}
                            {l.effectiveTo
                              ? ` s/d ${dateFmt.format(new Date(l.effectiveTo))}`
                              : ""}
                          </span>
                        </span>
                        {isCurrent && (
                          <form action={akhiriJabatan}>
                            <input type="hidden" name="leadershipId" value={l.id} />
                            <button
                              type="submit"
                              className="app-text-xs font-medium text-[var(--muted)] hover:text-[var(--danger)] hover:underline"
                            >
                              Akhiri jabatan
                            </button>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <form action={assignFormAction} className="admin-inline-form grid gap-2 sm:grid-cols-4">
                <input type="hidden" name="unitId" value={unit.id} />
                <label className="admin-tools__field">
                <span>Pengguna</span>
                <PilihanCari
                  name="userId"
                  required
                  kosong={{ label: "Pilih pengguna…", bisaDipilih: false }}
                  options={activeUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.loginIdentifier})` }))}
                />
                </label>
                <label className="admin-tools__field">
                  <span>Jabatan<Info>{KET.jabatan}</Info></span>
                  <input
                    name="title"
                    placeholder="mis. Ketua Departemen"
                    required
                    className="form__control"
                  />
                </label>
                <label className="admin-tools__field">
                  <span>Menjabat sejak</span>
                  <input
                    name="effectiveFrom"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="form__control"
                  />
                </label>
                <button
                  type="submit"
                  disabled={assignPending}
                  className="app-btn app-btn--primary"
                >
                  {assignPending ? "Menyimpan…" : "Tetapkan pimpinan"}
                </button>
                {assignState.error && (
                  <p role="alert" className="text-sm text-[var(--danger)] sm:col-span-4">
                    {assignState.error}
                  </p>
                )}
              </form>
            </div>
          </section>

          <RowPanelActions>
            <form action={ubahAktifUnit}>
              <input type="hidden" name="unitId" value={unit.id} />
              <input type="hidden" name="active" value={(!unit.active).toString()} />
              <button type="submit" className="app-btn">
                {unit.active ? "Nonaktifkan unit" : "Aktifkan unit"}
              </button>
            </form>
            <TombolHapus
              aksi={deleteUnitAction}
              id={unit.id}
              label="Hapus unit"
              judul={`Hapus unit ${unit.name}?`}
              pesan={<p>Unit hanya bisa dihapus bila belum punya sub-unit, pengguna, objek, atau riwayat jabatan. Bila sudah dipakai, nonaktifkan saja.</p>}
              berhasil="Unit dihapus."
            />
          </RowPanelActions>
        </div>
      }
    >
      {rowFields}
    </DataRow>
  );
}
