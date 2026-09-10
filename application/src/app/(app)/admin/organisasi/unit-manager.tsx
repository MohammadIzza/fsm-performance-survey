"use client";

import { useActionState, useState } from "react";
import { DataList, DataRow, RowTitle, RowField, RowActions } from "@/components/theme/data-list";
import { StatusPill } from "@/components/theme/status-pill";
import { createUnitAction, updateUnitAction, setUnitActiveAction } from "@/lib/actions/admin-units";
import { assignLeadershipAction, endLeadershipAction } from "@/lib/actions/admin-leadership";
import type { listUnitsWithMeta } from "@/lib/services/units";

type UnitWithMeta = Awaited<ReturnType<typeof listUnitsWithMeta>>[number];
type ActiveUser = { id: string; name: string; loginIdentifier: string };

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });

function unitLabel(u: { code: string; name: string }) {
  return `${u.name} (${u.code})`;
}

export function UnitManager({
  units,
  activeUsers,
}: {
  units: UnitWithMeta[];
  activeUsers: ActiveUser[];
}) {
  const [createState, createFormAction, createPending] = useActionState(createUnitAction, {});
  const parentOptions = units.filter((u) => u.active);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Tambah unit
        </h2>
        <form action={createFormAction} className="grid gap-3 sm:grid-cols-4">
          <input
            name="code"
            placeholder="Kode (mis. PS-INF)"
            required
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          />
          <input
            name="name"
            placeholder="Nama unit"
            required
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 sm:col-span-2"
          />
          <select
            name="parentId"
            defaultValue=""
            className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
          >
            <option value="">— Akar (tanpa induk) —</option>
            {parentOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {unitLabel(u)}
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
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              {createPending ? "Menyimpan…" : "Tambah unit"}
            </button>
          </div>
        </form>
      </div>

      <DataList
        columns={[
          ["title", "Unit"],
          ["duration", "Induk"],
          ["location", "Pimpinan aktif"],
          ["topic", "Status"],
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
  const [editing, setEditing] = useState(false);
  const [leadershipOpen, setLeadershipOpen] = useState(false);
  const [updateState, updateFormAction, updatePending] = useActionState(updateUnitAction, {});
  const [assignState, assignFormAction, assignPending] = useActionState(assignLeadershipAction, {});

  const parent = allUnits.find((u) => u.id === unit.parentId);
  const parentOptions = allUnits.filter((u) => u.id !== unit.id && u.active);

  const rowFields = (
    <>
      <RowTitle>
        {unit.name}
        <span className="sb__subtitle">{unit.code}</span>
      </RowTitle>
      <RowField kind="duration" icon={false}>
        {parent ? parent.name : "\u2014"}
      </RowField>
      <RowField kind="location" icon={false}>
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
      <RowField kind="topic" icon={false}>
        <StatusPill tone={unit.active ? "selesai" : "netral"}>
          {unit.active ? "Aktif" : "Nonaktif"}
        </StatusPill>
      </RowField>
      <RowActions>
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button type="button" onClick={() => setLeadershipOpen((v) => !v)}>
          Pimpinan
        </button>
        <form action={setUnitActiveAction}>
          <input type="hidden" name="unitId" value={unit.id} />
          <input type="hidden" name="active" value={(!unit.active).toString()} />
          <button type="submit">{unit.active ? "Nonaktifkan" : "Aktifkan"}</button>
        </form>
      </RowActions>
    </>
  );

  // Form sunting dan panel pimpinan dulu menempati satu <tr> tambahan ber-colSpan di bawah
  // barisnya. Sekarang keduanya jadi panel di dalam <li> yang sama; barisnya tetap terlihat
  // selama disunting, jadi jelas unit mana yang sedang diubah.
  return (
    <DataRow
      panel={
        editing ? (
          <form action={updateFormAction} className="grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="unitId" value={unit.id} />
            <input
              name="code"
              defaultValue={unit.code}
              required
              className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            <input
              name="name"
              defaultValue={unit.name}
              required
              className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 sm:col-span-2"
            />
            <select
              name="parentId"
              defaultValue={unit.parentId ?? ""}
              className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            >
              <option value="">— Akar (tanpa induk) —</option>
              {parentOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {unitLabel(u)}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 sm:col-span-4">
              <button
                type="submit"
                disabled={updatePending}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {updatePending ? "Menyimpan…" : "Simpan"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-[14px] font-medium text-[var(--foreground)] transition hover:bg-black/[0.03]"
              >
                Batal
              </button>
              {updateState.error && (
                <p role="alert" className="text-sm text-[var(--danger)]">
                  {updateState.error}
                </p>
              )}
            </div>
          </form>
        ) : leadershipOpen ? (
          <div className="space-y-4">
              {unit.leaderships.length > 0 && (
                <ul className="space-y-1.5">
                  {unit.leaderships.map((l) => {
                    const isCurrent = unit.currentLeaders.some((c) => c.id === l.id);
                    return (
                      <li
                        key={l.id}
                        className="flex items-center justify-between rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px]"
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
                          <form action={endLeadershipAction}>
                            <input type="hidden" name="leadershipId" value={l.id} />
                            <button
                              type="submit"
                              className="text-[12px] font-medium text-[var(--muted)] hover:text-[var(--danger)] hover:underline"
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

              <form action={assignFormAction} className="grid gap-2 sm:grid-cols-4">
                <input type="hidden" name="unitId" value={unit.id} />
                <select
                  name="userId"
                  required
                  defaultValue=""
                  className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                >
                  <option value="" disabled>
                    Pilih pengguna…
                  </option>
                  {activeUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.loginIdentifier})
                    </option>
                  ))}
                </select>
                <input
                  name="title"
                  placeholder="Jabatan (mis. Ketua Departemen)"
                  required
                  className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                />
                <input
                  name="effectiveFrom"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[13px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
                />
                <button
                  type="submit"
                  disabled={assignPending}
                  className="rounded-xl bg-[var(--accent)] px-3 py-2 text-[13px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
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
        ) : null
      }
    >
      {rowFields}
    </DataRow>
  );
}
