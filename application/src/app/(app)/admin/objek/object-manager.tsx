"use client";

import { useActionState, useMemo, useState } from "react";
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
      <AdminActionList>
        <AdminAction
          name="Tambah objek"
          description="Master objek yang dapat dinilai, lalu dipilih sebagai peserta kategori."
        >
          <ObjectForm
            action={createObjectAction}
            objectTypes={objectTypes}
            units={units}
            users={users}
            submitLabel="Tambah objek"
          />
        </AdminAction>

        <AdminAction
          name="Kelola jenis objek"
          description="Daftar jenis yang dapat dipilih saat menambah objek."
        >
          <form action={typeFormAction} className="grid gap-3 sm:grid-cols-4">
            <input name="code" placeholder="Kode (mis. PRESTASI)" required className="form__control" />
            <input name="name" placeholder="Nama (mis. Prestasi)" required className="form__control" />
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

  // Form sunting dulu menempati satu <tr> tambahan ber-colSpan di bawah barisnya; sekarang jadi
  // panel di dalam <li> yang sama, dengan barisnya tetap terlihat selama disunting.
  return (
    <DataRow
      collapsible
      panel={
        <div className="admin-row-panel">
          <RowPanelDetails>
            <RowPanelField label="Jenis">{object.type.name}</RowPanelField>
            <RowPanelField label="Unit pemilik">{object.ownerUnit.name}</RowPanelField>
            <RowPanelField label="Penanggung jawab">
              {object.responsibleUser ? object.responsibleUser.name : "—"}
            </RowPanelField>
            {object.url && (
              <RowPanelField label="Tautan">
                <a href={object.url} target="_blank" rel="noreferrer">
                  Buka objek ↗
                </a>
              </RowPanelField>
            )}
            <RowPanelField label="Status">
              <StatusPill tone={object.active ? "selesai" : "netral"}>
                {object.active ? "Aktif" : "Nonaktif"}
              </StatusPill>
            </RowPanelField>
          </RowPanelDetails>

          <section className="admin-row-section">
            <h3 className="app-panel__label app-panel__label--tight">Ubah objek</h3>
            <ObjectForm
              action={updateObjectAction}
              objectTypes={objectTypes}
              units={units}
              users={users}
              submitLabel="Simpan"
              defaultValues={object}
            />
          </section>

          <RowPanelActions>
            <form action={setObjectActiveAction}>
              <input type="hidden" name="objectId" value={object.id} />
              <input type="hidden" name="active" value={(!object.active).toString()} />
              <button type="submit" className="app-btn">
                {object.active ? "Nonaktifkan objek" : "Aktifkan objek"}
              </button>
            </form>
          </RowPanelActions>
        </div>
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
    <form
      action={formAction}
      className={`${defaultValues ? "admin-inline-form " : ""}grid gap-3 sm:grid-cols-3`}
    >
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
