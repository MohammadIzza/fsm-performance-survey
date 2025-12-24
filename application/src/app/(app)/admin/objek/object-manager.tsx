"use client";

import { useActionState, useMemo, useState } from "react";
import { DataList, DataRow, RowTitle, RowField, RowActions } from "@/components/theme/data-list";
import { StatusPill } from "@/components/theme/status-pill";
import { FilterBar, FilterField } from "@/components/theme/filter-bar";
import { TextInput } from "@/components/theme/form-field";
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
  "form__control";

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
      <div className="app-panel app-panel--ruled">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="app-panel__label app-panel__label--tight">
            Tambah objek
          </h2>
          <button
            type="button"
            onClick={() => setShowTypeForm((v) => !v)}
            className="app-text-xs font-medium text-[var(--accent)] hover:underline"
          >
            {showTypeForm ? "Tutup" : "Kelola jenis objek"}
          </button>
        </div>

        {showTypeForm && (
          <form
            action={typeFormAction}
            className="app-note mb-4 flex flex-wrap items-end gap-2"
          >
            <div className="flex flex-col gap-1">
              <label className="app-text-xs text-[var(--muted)]">Kode</label>
              <input
                name="code"
                placeholder="mis. PRESTASI"
                required
                className="rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 app-text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="app-text-xs text-[var(--muted)]">Nama</label>
              <input
                name="name"
                placeholder="mis. Prestasi"
                required
                className="rounded-lg border border-[var(--border)] bg-transparent px-2.5 py-1.5 app-text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="submit"
              disabled={typePending}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 app-text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
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

      <FilterBar>
        <FilterField label="Cari objek" htmlFor="cari-objek" wide>
          <TextInput
            id="cari-objek"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nama objek, jenis, unit, atau penanggung jawab…"
          />
        </FilterField>
      </FilterBar>

      {visibleObjects.length === 0 ? (
        <div className="app-empty-box">
          <p className="text-[var(--muted)]">
            Tidak ada objek yang cocok dengan &ldquo;{search}&rdquo;.
          </p>
        </div>
      ) : (
      <DataList
        columns={[
          ["title", "Objek"],
          ["duration", "Jenis"],
          ["location", "Unit pemilik"],
          ["topic", "Penanggung jawab"],
          ["dates", "Status"],
          ["price", "Aksi"],
        ]}
      >
        {visibleObjects.map((obj) => (
              <ObjectRow
                key={obj.id}
                object={obj}
                objectTypes={objectTypes}
                units={units}
                users={users}
              />
            ))}
      </DataList>
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

  // Form sunting dulu menempati satu <tr> tambahan ber-colSpan di bawah barisnya; sekarang jadi
  // panel di dalam <li> yang sama, dengan barisnya tetap terlihat selama disunting.
  return (
    <DataRow
      collapsible
      panel={
        editing ? (
          <ObjectForm
            action={updateObjectAction}
            objectTypes={objectTypes}
            units={units}
            users={users}
            submitLabel="Simpan"
            defaultValues={object}
            onCancel={() => setEditing(false)}
          />
        ) : null
      }
    >
      <RowTitle>
        {object.name}
        {object.url && (
          <a
            href={object.url}
            target="_blank"
            rel="noreferrer"
            className="sb__subtitle"
            style={{ color: "var(--color-brand-3)" }}
          >
            Tautan
          </a>
        )}
      </RowTitle>
      <RowField kind="duration" icon={false} detail>
        {object.type.name}
      </RowField>
      <RowField kind="location" icon={false} detail>
        {object.ownerUnit.name}
      </RowField>
      <RowField kind="topic" icon={false} detail>
        {object.responsibleUser ? object.responsibleUser.name : "\u2014"}
      </RowField>
      <RowField kind="dates" icon={false}>
        <StatusPill tone={object.active ? "selesai" : "netral"}>
          {object.active ? "Aktif" : "Nonaktif"}
        </StatusPill>
      </RowField>
      <RowActions>
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <form action={setObjectActiveAction}>
          <input type="hidden" name="objectId" value={object.id} />
          <input type="hidden" name="active" value={(!object.active).toString()} />
          <button type="submit">{object.active ? "Nonaktifkan" : "Aktifkan"}</button>
        </form>
      </RowActions>
    </DataRow>
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
          className="app-btn app-btn--primary"
        >
          {pending ? "Menyimpan…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="app-btn"
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
