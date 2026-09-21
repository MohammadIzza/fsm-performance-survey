import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { surveyPrisma?: PrismaClient };
// Hash kata sandi disembunyikan dari SETIAP query secara bawaan. Baris pengguna ikut terkirim ke
// peramban di banyak tempat (daftar Pengguna, penugasan, objek rujukan, jejak audit), dan
// mengingat-ingat untuk membuang kolom ini di tiap tempat itu pasti suatu saat terlewat. Hanya
// pemeriksaan login yang memintanya, secara eksplisit lewat `omit: { passwordHash: false }`.
const client =
  globalForPrisma.surveyPrisma ??
  (new PrismaClient({ omit: { user: { passwordHash: true } } }) as unknown as PrismaClient);
if (process.env.NODE_ENV !== "production") globalForPrisma.surveyPrisma = client;
const context = new AsyncLocalStorage<Prisma.TransactionClient>();

// Nested domain operations share the outer transaction, including audit and final snapshots.
export const prisma = new Proxy(client, {
  get(target, key) {
    const tx = context.getStore();
    if (tx && key === "$transaction") return async (fn: (db: Prisma.TransactionClient) => unknown) => fn(tx);
    const db = tx ?? target;
    const value = Reflect.get(db, key);
    return typeof value === "function" ? value.bind(db) : value;
  },
});

// A demo-wide transaction lock serializes writes across processes. Reads remain concurrent.
// This also prevents finalize/submit, configuration/preview and two draft writes racing.
export async function atomic<T>(work: () => Promise<T>): Promise<T> {
  if (context.getStore()) return work();
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(831726451)`;
    return context.run(tx, work);
  }, { maxWait: 15000, timeout: 60000 });
}

// True when already running inside someone else's atomic() transaction (e.g. calculateResults
// invoked from within finalizePeriod's own atomic block). Lets a callee choose transactional
// semantics deliberately: join the caller's all-or-nothing transaction when nested (so a failure
// downstream correctly discards everything, including work this callee already did), or write
// durably outside it when called standalone (so its own failure stays visible instead of being
// silently undone by a rollback nobody asked for).
export function isNested(): boolean {
  return context.getStore() !== undefined;
}

// Bypasses the AsyncLocalStorage-bound proxy entirely — writes through this client commit on
// their own, independent of any enclosing atomic() transaction. Use only for durability that must
// survive an enclosing rollback (see isNested() above); never as a shortcut around the lock.
export const rawClient = client;
