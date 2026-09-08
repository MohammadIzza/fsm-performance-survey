"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createObjectAction,
  updateObjectAction,
  setObjectActiveAction,
  createObjectTypeAction,
} from "@/lib/actions/admin-objects";
import type { listObjects } from "@/lib/services/objects";

type ObjectWithMeta = Awaited<ReturnType<typeof listObjects>>[number];
type ObjectType = { id: string; code: string; name: string };
type Unit = { id: string; code: string; name: string };
type UserOption = { id: string; name: string; loginIdentifier: string };

const fieldClass =
  "rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

export function ObjectManager({
  objects,
  objectTypes,
  units,
  users,
}: {
  objects: ObjectWithMeta[];
  objectTypes: ObjectType[];
  units: Unit[];
  users: UserOption[];
}) {
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [typeState, typeFormAction, typePending] = useActionState(createObjectTypeAction, {});
  // Bab 16.2: "Tabel panjang memiliki pencarian, filter, pagination, dan state kosong" — master
  // objek mencakup seluruh orang/unit/karya lintas kategori, jadi bisa cepat panjang.
  const [search, setSearch] = useState("");
  const visibleObjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return objects;
    return objects.filter(
      (o) =>
        o.name.toLowerCase().includes(term) ||
        o.type.name.toLowerCase().includes(term) ||
        o.ownerUnit?.name.toLowerCase().includes(term) ||
        o.responsibleUser?.name.toLowerCase().includes(term)
    );
  }, [objects, search]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Tambah objek
          </h2>
          <button
            type="button"
            onClick={() => setShowTypeForm((v) => !v)}
            className="text-[12px] font-medium text-[var(--accent)] hover:underline"
          >
            {showTypeForm ? "Tutup" : "Kelola jenis objek"}
          </button>
        </div>

        {showTypeForm && (
          <form
            action={typeFormAction}
            className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-black/[0.02] p-3"
          >
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-[var(--muted)]">Kode</label>
              <input
                name="code"
                placeholder="mis. PRESTASI"
                required
                className="rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-[var(--muted)]">Nama</label>
              <input
                name="name"
                placeholder="mis. Prestasi"
                required
                className="rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-[13px] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="submit"
              disabled={typePending}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              {typePending ? "Menyimpan…" : "Tambah jenis"}
            </button>
            {typeState.error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {typeState.error}
              </p>
            )}
          </form>
        )}

        <ObjectForm
          action={createObjectAction}
          objectTypes={objectTypes}
          units={units}
          users={users}
          submitLabel="Tambah objek"
        />
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari nama objek, jenis, unit, atau penanggung jawab…"
        aria-label="Cari objek"
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-[14px] text-[var(--foreground)] shadow-sm placeholder:text-[var(--muted)]"
      />

      {visibleObjects.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <p className="text-[15px] text-[var(--muted)]">
            Tidak ada objek yang cocok dengan &ldquo;{search}&rdquo;.
          </p>
        </div>
      ) : (
      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <table className="w-full min-w-[860px] text-left text-[14px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[12px] uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Objek</th>
              <th className="px-4 py-3 font-medium">Jenis</th>
              <th className="px-4 py-3 font-medium">Unit pemilik</th>
              <th className="px-4 py-3 font-medium">Penanggung jawab</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {visibleObjects.map((obj) => (
              <ObjectRow
                key={obj.id}
                object={obj}
                objectTypes={objectTypes}
                units={units}
                users={users}
              />
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

function ObjectRow({
  object,
  objectTypes,
  units,
  users,
}: {
  object: ObjectWithMeta;
  objectTypes: ObjectType[];
  units: Unit[];
  users: UserOption[];
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr className="border-b border-[var(--border)] bg-black/[0.015]">
        <td colSpan={6} className="px-4 py-4">
          <ObjectForm
            action={updateObjectAction}
            objectTypes={objectTypes}
            units={units}
            users={users}
            submitLabel="Simpan"
            defaultValues={object}
            onCancel={() => setEditing(false)}
          />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-[var(--border)] last:border-b-0">
      <td className="px-4 py-3">
        <div className="font-medium text-[var(--foreground)]">{object.name}</div>
        {object.url && (
          <a
            href={object.url}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-[var(--accent)] hover:underline"
          >
            Tautan
          </a>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--muted)]">{object.type.name}</td>
      <td className="px-4 py-3 text-[var(--muted)]">{object.ownerUnit.name}</td>
      <td className="px-4 py-3 text-[var(--muted)]">
        {object.responsibleUser ? object.responsibleUser.name : "—"}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium ${
            object.active
              ? "bg-[var(--success)]/10 text-[var(--success)]"
              : "bg-black/5 text-[var(--muted)]"
          }`}
        >
          {object.active ? "Aktif" : "Nonaktif"}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[13px] font-medium text-[var(--accent)] hover:underline"
          >
            Edit
          </button>
          <form action={setObjectActiveAction}>
            <input type="hidden" name="objectId" value={object.id} />
            <input type="hidden" name="active" value={(!object.active).toString()} />
            <button
              type="submit"
              className="text-[13px] font-medium text-[var(--muted)] hover:text-[var(--danger)] hover:underline"
            >
              {object.active ? "Nonaktifkan" : "Aktifkan"}
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}

function ObjectForm({
  action,
  objectTypes,
  units,
  users,
  submitLabel,
  defaultValues,
  onCancel,
}: {
  action: (prev: { error?: string }, formData: FormData) => Promise<{ error?: string }>;
  objectTypes: ObjectType[];
  units: Unit[];
  users: UserOption[];
  submitLabel: string;
  defaultValues?: ObjectWithMeta;
  onCancel?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [typeId, setTypeId] = useState(defaultValues?.typeId ?? objectTypes[0]?.id ?? "");

  const selectedType = useMemo(
    () => objectTypes.find((t) => t.id === typeId),
    [objectTypes, typeId]
  );
  const isOrang = selectedType?.code === "ORANG";
  const isUnitType = selectedType?.code === "UNIT";
  const isKarya = selectedType?.code === "KARYA" || selectedType?.code === "LAINNYA";

  const defaultContributorIds = defaultValues?.contributors.map((c) => c.userId) ?? [];

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      {defaultValues && <input type="hidden" name="objectId" value={defaultValues.id} />}

      <select
        name="typeId"
        required
        value={typeId}
        onChange={(e) => setTypeId(e.target.value)}
        className={fieldClass}
      >
        {objectTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <input
        name="name"
        placeholder="Nama objek"
        required
        defaultValue={defaultValues?.name}
        className={`${fieldClass} sm:col-span-2`}
      />

      <select name="ownerUnitId" required defaultValue={defaultValues?.ownerUnitId ?? ""} className={fieldClass}>
        <option value="" disabled>
          Unit pemilik…
        </option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.code})
          </option>
        ))}
      </select>

      {isOrang && (
        <select
          name="referenceUserId"
          required
          defaultValue={defaultValues?.referenceUserId ?? ""}
          className={fieldClass}
        >
          <option value="" disabled>
            Pengguna terkait…
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.loginIdentifier})
            </option>
          ))}
        </select>
      )}

      {isUnitType && (
        <select
          name="referenceUnitId"
          required
          defaultValue={defaultValues?.referenceUnitId ?? ""}
          className={fieldClass}
        >
          <option value="" disabled>
            Unit yang dinilai…
          </option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.code})
            </option>
          ))}
        </select>
      )}

      {!isOrang && (
        <select
          name="responsibleUserId"
          defaultValue={defaultValues?.responsibleUserId ?? ""}
          className={fieldClass}
        >
          <option value="">— Penanggung jawab (opsional saat draf) —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.loginIdentifier})
            </option>
          ))}
        </select>
      )}

      {isKarya && (
        <>
          <input
            name="url"
            placeholder="URL karya (opsional)"
            defaultValue={defaultValues?.url ?? ""}
            className={fieldClass}
          />
          <select
            name="contributorUserIds"
            multiple
            defaultValue={defaultContributorIds}
            className={`${fieldClass} h-auto sm:col-span-2`}
            size={Math.min(4, users.length)}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.loginIdentifier})
              </option>
            ))}
          </select>
        </>
      )}

      <textarea
        name="description"
        placeholder="Deskripsi (opsional)"
        defaultValue={defaultValues?.description ?? ""}
        rows={2}
        className={`${fieldClass} sm:col-span-3`}
      />

      <div className="flex items-center gap-2 sm:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-[14px] font-medium text-[var(--foreground)] transition hover:bg-black/[0.03]"
          >
            Batal
          </button>
        )}
        {state.error && (
          <p role="alert" className="text-sm text-[var(--danger)] whitespace-pre-line">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
