import type { listUnitsWithMeta } from "@/lib/services/units";

type UnitWithMeta = Awaited<ReturnType<typeof listUnitsWithMeta>>[number];

// Bagan piramida: FSM (unit akar) di puncak-tengah, subunit melebar ke bawah dan terhubung garis
// (lihat kelas .org-tree di globals.css) — bukan daftar menyamping. Pengelolaan (tambah/edit/
// pimpinan) tetap lewat tabel UnitManager di bawahnya; komponen ini murni visual.
export function OrgTree({ units }: { units: UnitWithMeta[] }) {
  const byParent = new Map<string | null, UnitWithMeta[]>();
  for (const u of units) {
    const key = u.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(u);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "id"));
  }

  const roots = byParent.get(null) ?? [];

  if (roots.length === 0) {
    return <p className="text-[13px] text-[var(--muted)]">Belum ada unit.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-10">
      <ul className="org-tree min-w-max">
        {roots.map((u) => (
          <TreeNode key={u.id} unit={u} byParent={byParent} isRoot />
        ))}
      </ul>
    </div>
  );
}

function TreeNode({
  unit,
  byParent,
  isRoot = false,
}: {
  unit: UnitWithMeta;
  byParent: Map<string | null, UnitWithMeta[]>;
  isRoot?: boolean;
}) {
  const children = byParent.get(unit.id) ?? [];

  return (
    <li>
      <div
        className={`inline-flex flex-col items-center gap-0.5 rounded-xl border px-3.5 py-2.5 text-center shadow-sm ${
          isRoot ? "border-[var(--accent)] bg-[var(--accent-tint)]" : "border-[var(--border)] bg-[var(--surface)]"
        } ${!unit.active ? "opacity-50" : ""}`}
      >
        <span
          className={`whitespace-nowrap text-[13px] font-medium ${
            isRoot ? "text-[var(--accent)]" : "text-[var(--foreground)]"
          }`}
        >
          {unit.name}
        </span>
        <span className="font-mono text-[10px] text-[var(--muted-2)]">{unit.code}</span>
        {unit.currentLeaders.length > 0 && (
          <span className="whitespace-nowrap text-[10px] text-[var(--muted)]">
            {unit.currentLeaders.map((l) => l.user.name).join(", ")}
          </span>
        )}
        {!unit.active && <span className="text-[10px] font-medium text-[var(--muted)]">Nonaktif</span>}
      </div>
      {children.length > 0 && (
        <ul>
          {children.map((c) => (
            <TreeNode key={c.id} unit={c} byParent={byParent} />
          ))}
        </ul>
      )}
    </li>
  );
}
