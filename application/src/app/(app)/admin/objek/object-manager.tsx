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
import { PilihanCari, PilihanCariBanyak } from "@/components/theme/pilihan-cari";

type ObjectWithMeta = Awaited<ReturnType<typeof listObjects>>[number];
type ObjectType = { id: string; code: string; name: string };
type Unit = { id: string; code: string; name: string; parentId?: string | null };
type UserOption = { id: string; name: string; loginIdentifier: string; primaryUnitId: string | null };

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
            <label className="admin-tools__field">
              <span>Nama jenis</span>
              <input name="name" placeholder="mis. Prestasi" required className="form__control" />
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
  // Bawaannya Orang: sebagian besar objek yang didaftarkan adalah orang, dan jenis itulah yang paling
  // sering dipilih (daftar jenis sendiri diurutkan Orang, Unit, Karya, Lainnya — listObjectTypes).
  const [typeId, setTypeId] = useState(
    defaultValues?.typeId ??
      objectTypes.find((t) => t.code === "ORANG")?.id ??
      objectTypes[0]?.id ??
      ""
  );

  const selectedType = useMemo(
    () => objectTypes.find((t) => t.id === typeId),
    [objectTypes, typeId]
  );
  const isOrang = selectedType?.code === "ORANG";
  const isUnitType = selectedType?.code === "UNIT";
  const isKarya = selectedType?.code === "KARYA" || selectedType?.code === "LAINNYA";

  const defaultContributorIds = defaultValues?.contributors.map((c) => c.userId) ?? [];

  // Objek jenis Orang dan Unit merujuk data yang sudah punya nama dan unit. Begitu pengguna (atau unit
  // yang dinilai) dipilih, nama objek dan unit pemiliknya diisi dari sana — admin tidak mengulang
  // data yang sama. Isian tetap bisa diganti; yang sudah diubah admin sendiri tidak ditimpa lagi.
  const [nama, setNama] = useState(defaultValues?.name ?? "");
  const [namaOtomatis, setNamaOtomatis] = useState<string | null>(null);
  const [unitPemilik, setUnitPemilik] = useState(defaultValues?.ownerUnitId ?? "");
  const [unitOtomatis, setUnitOtomatis] = useState<string | null>(null);
  const [penggunaTerkait, setPenggunaTerkait] = useState(defaultValues?.referenceUserId ?? "");
  const penggunaDipilih = users.find((u) => u.id === penggunaTerkait);

  const isiOtomatis = (namaBaru: string, unitBaru: string | null) => {
    if (nama.trim() === "" || nama === namaOtomatis) {
      setNama(namaBaru);
      setNamaOtomatis(namaBaru);
    }
    if (unitBaru && (unitPemilik === "" || unitPemilik === unitOtomatis)) {
      setUnitPemilik(unitBaru);
      setUnitOtomatis(unitBaru);
    }
  };

  const pilihPengguna = (id: string) => {
    setPenggunaTerkait(id);
    const u = users.find((x) => x.id === id);
    if (u) isiOtomatis(u.name, u.primaryUnitId);
  };

  // Prodi dinilai oleh unit di atasnya (departemen), jadi unit pemiliknya adalah induk unit yang dinilai.
  const pilihUnitDinilai = (id: string) => {
    const u = units.find((x) => x.id === id);
    if (u) isiOtomatis(u.name, u.parentId ?? u.id);
  };

  const kembalikanAwal = () => {
    setNama(defaultValues?.name ?? "");
    setNamaOtomatis(null);
    setUnitPemilik(defaultValues?.ownerUnitId ?? "");
    setUnitOtomatis(null);
    setPenggunaTerkait(defaultValues?.referenceUserId ?? "");
  };

  const kolomPengguna = isOrang && (
    <label className="admin-tools__field">
      <span>Pengguna terkait</span>
      <PilihanCari
        name="referenceUserId"
        required
        value={penggunaTerkait}
        onChange={pilihPengguna}
        kosong={{ label: "Pilih pengguna…", bisaDipilih: false }}
        options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.loginIdentifier})` }))}
      />
    </label>
  );

  const kolomUnitDinilai = isUnitType && (
    <label className="admin-tools__field">
      <span>Unit yang dinilai</span>
      <PilihanCari
        name="referenceUnitId"
        required
        defaultValue={defaultValues?.referenceUnitId ?? ""}
        onChange={pilihUnitDinilai}
        kosong={{ label: "Unit yang dinilai…", bisaDipilih: false }}
        options={units.map((u) => ({ value: u.id, label: u.name }))}
      />
    </label>
  );

  let petunjukUnit: string | null = null;
  if (isOrang && penggunaDipilih) {
    petunjukUnit = penggunaDipilih.primaryUnitId
      ? "Terisi dari unit utama pengguna. Ganti bila ia dinilai di unit lain."
      : "Pengguna ini belum punya unit utama — pilih unit pemiliknya.";
  } else if (isUnitType && unitOtomatis && unitPemilik === unitOtomatis) {
    petunjukUnit = "Terisi dari induk unit yang dinilai.";
  }

  return (
    <form
      action={formAction}
      onReset={kembalikanAwal}
      className={`${defaultValues ? "admin-inline-form " : ""}grid gap-3 sm:grid-cols-3`}
    >
      {defaultValues && <input type="hidden" name="objectId" value={defaultValues.id} />}

      <label className="admin-tools__field">
      <span>Jenis objek</span>
      <PilihanCari
        name="typeId"
        required
        value={typeId}
        onChange={setTypeId}
        options={objectTypes.map((t) => ({ value: t.id, label: t.name }))}
      />
      </label>

      {/* Orang dan Unit: data rujukannya dipilih lebih dulu, karena nama dan unit pemilik diisi dari sana. */}
      {kolomPengguna}
      {kolomUnitDinilai}

      <label className={`admin-tools__field ${isOrang || isUnitType ? "" : "sm:col-span-2"}`.trim()}>
        <span>Nama objek</span>
        <input
          name="name"
          placeholder={isOrang ? "Terisi dari pengguna terkait" : isUnitType ? "Terisi dari unit yang dinilai" : "Nama objek"}
          required
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="admin-tools__field">
      <span>Unit pemilik</span>
      {petunjukUnit && <span className="admin-tools__hint">{petunjukUnit}</span>}
      <PilihanCari
        name="ownerUnitId"
        required
        value={unitPemilik}
        onChange={setUnitPemilik}
        kosong={{ label: "Pilih unit pemilik…", bisaDipilih: false }}
        options={units.map((u) => ({ value: u.id, label: u.name }))}
      />
      </label>

      {!isOrang && (
        <label className="admin-tools__field">
        <span>Penanggung jawab</span>
        <PilihanCari
          name="responsibleUserId"
          defaultValue={defaultValues?.responsibleUserId ?? ""}
          kosong={{ label: "— Belum ditentukan (boleh saat draf) —", bisaDipilih: true }}
          options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.loginIdentifier})` }))}
        />
        </label>
      )}

      {isKarya && (
        <>
          <label className="admin-tools__field">
            <span>URL karya (opsional)</span>
            <input
              name="url"
              placeholder="https://…"
              defaultValue={defaultValues?.url ?? ""}
              className={fieldClass}
            />
          </label>
          <label className="admin-tools__field sm:col-span-2">
          <span>Ikut membuat karya ini</span>
          {/* Tanpa kalimat ini kolomnya hanya berjudul "Kontributor" dan tidak ada yang
              menjelaskan akibatnya — padahal satu-satunya gunanya adalah menyingkirkan orang
              dari daftar penilai karyanya sendiri. */}
          <span className="admin-tools__hint">
            Mereka tidak akan ditugaskan menilai karya ini, selama kategorinya menyalakan
            &ldquo;Kecualikan pembuat karya sebagai penilai&rdquo;. Boleh lebih dari satu.
          </span>
          <PilihanCariBanyak
            name="contributorUserIds"
            defaultValue={defaultContributorIds}
            options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.loginIdentifier})` }))}
          />
          </label>
        </>
      )}

      <label className="admin-tools__field sm:col-span-3">
        <span>Keterangan (opsional)</span>
        <textarea
          name="description"
          placeholder="Keterangan singkat"
          defaultValue={defaultValues?.description ?? ""}
          rows={2}
          className={fieldClass}
        />
      </label>

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
