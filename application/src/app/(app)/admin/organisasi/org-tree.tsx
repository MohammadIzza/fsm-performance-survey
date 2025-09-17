import type { listUnitsWithMeta } from "@/lib/services/units";
import { OrgTreeViewport } from "./org-tree-viewport";

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
    return <p className="app-text-sm text-[var(--muted)]">Belum ada unit.</p>;
  }

  return (
    <OrgTreeViewport>
      <ul className="org-tree">
        {roots.map((u) => (
          <TreeNode key={u.id} unit={u} byParent={byParent} isRoot />
        ))}
      </ul>
    </OrgTreeViewport>
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
        className={`org-tree__node inline-flex flex-col items-center gap-0.5 text-center ${
          isRoot ? "org-tree__node--root" : ""
        } ${!unit.active ? "opacity-50" : ""}`}
      >
        <span
          className={`whitespace-nowrap app-text-sm font-medium ${
            isRoot ? "text-[var(--accent)]" : "text-[var(--foreground)]"
          }`}
        >
          {unit.name}
        </span>
        {unit.currentLeaders.length > 0 && (
          <span className="whitespace-nowrap app-text-xs text-[var(--muted)]">
            {unit.currentLeaders.map((l) => l.user.name).join(", ")}
          </span>
        )}
        {!unit.active && <span className="app-text-xs font-medium text-[var(--muted)]">Nonaktif</span>}
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
