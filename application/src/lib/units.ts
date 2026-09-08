import { prisma } from "@/lib/prisma";

// Dipakai bersama oleh otorisasi lingkup (authz.ts) dan perencanaan penugasan
// (assignmentPlanning.ts) — keduanya perlu menelusuri unit + seluruh keturunannya.

export async function loadUnitTree() {
  const units = await prisma.unit.findMany({
    select: { id: true, parentId: true },
  });
  const childrenByParent = new Map<string, string[]>();
  for (const u of units) {
    if (!u.parentId) continue;
    const list = childrenByParent.get(u.parentId) ?? [];
    list.push(u.id);
    childrenByParent.set(u.parentId, list);
  }
  return { allUnitIds: units.map((u) => u.id), childrenByParent };
}

export function collectDescendants(
  rootId: string,
  childrenByParent: Map<string, string[]>
): string[] {
  const result = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const child of childrenByParent.get(current) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        queue.push(child);
      }
    }
  }
  return Array.from(result);
}

export async function getUnitAndDescendantIds(unitId: string): Promise<string[]> {
  const { childrenByParent } = await loadUnitTree();
  return collectDescendants(unitId, childrenByParent);
}
