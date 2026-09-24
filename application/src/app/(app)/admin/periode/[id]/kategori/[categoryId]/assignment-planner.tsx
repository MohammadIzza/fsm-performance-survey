"use client";

import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";

import { useAksi } from "@/components/theme/notifikasi";
import {
  previewAssignmentPlanAction,
  commitAssignmentPlanAction,
} from "@/lib/actions/admin-assignments";
import { AlasanBerjalan } from "@/components/theme/alasan-berjalan";
import { StatusPill } from "@/components/theme/status-pill";
import type { PreviewState } from "@/lib/actions/admin-assignments";

const groupLabel: Record<string, string> = {
  PIMPINAN: "Pimpinan",
  SELAIN_PIMPINAN: "Selain Pimpinan",
};

export function AssignmentPlanner({
  periodId,
  categoryId,
  editable,
  berjalan = false,
}: {
  periodId: string;
  categoryId: string;
  /** Boleh menerbitkan tugas baru — saat Draf, dan saat Aktif sebelum tenggat. */
  editable: boolean;
  berjalan?: boolean;
}) {
  const [previewState, previewAction, previewPending] = useAksi(previewAssignmentPlanAction, {}, null);
  const [commitState, commitAction, commitPending] = useAksi(commitAssignmentPlanAction, {}, "Tugas penilaian dibagikan.");

  if (!editable) {
    return (
      <p className="app-text-sm text-[var(--muted)]">
        Pembagian tugas hanya dapat dijalankan selama periode berstatus Draf, atau Aktif sebelum
        tenggatnya lewat.
      </p>
    );
  }

  const plan = previewState.plan;

  return (
    <div className="assignment-planner space-y-4">
      {/* Pratinjau tidak mengubah apa pun — ia hanya menghitung usulan. Bentuknya tautan sebaris,
          bukan tombol bertepi seperti "Terapkan penugasan" di bawah, supaya keduanya tidak
          terbaca sebagai dua tindakan yang sama beratnya. */}
      <form action={previewAction} className="assignment-planner__preview">
        <input type="hidden" name="categoryId" value={categoryId} />
        <button
          type="submit"
          disabled={previewPending}
          className="app-btn app-btn--polos assignment-planner__preview-button"
        >
          {previewPending ? "Menghitung…" : "Pratinjau pengacakan →"}
        </button>
      </form>

      {previewState.error && (
        <p role="alert" className="assignment-planner__message text-[var(--danger)]">
          {previewState.error}
        </p>
      )}

      {plan && (
        <div className="assignment-planner__result space-y-3">
          <RencanaTugas plan={plan} />

          <div className="assignment-planner__footer">
            {plan.totalNewAssignments > 0 ? (
              <form action={commitAction} className="assignment-planner__apply">
                <input type="hidden" name="categoryId" value={categoryId} />
                <input type="hidden" name="periodId" value={periodId} />
                <input type="hidden" name="seed" value={plan.seed} /><input type="hidden" name="fingerprint" value={plan.fingerprint??""} />
                {plan.entries.some(e=>e.shortage>0) && (
                  <label className="assignment-planner__acceptance">
                    <input type="checkbox" required />
                    <span>
                      Saya menerima kekurangan calon yang ditampilkan. Minimum respons tetap berlaku.
                    </span>
                  </label>
                )}
                {berjalan && (
                  <AlasanBerjalan contoh="Mis. objek baru ditambahkan setelah periode dibuka" />
                )}
                <div className="assignment-planner__apply-row">
                  <p className="assignment-planner__summary text-[var(--muted)]">
                    {plan.totalNewAssignments} tugas baru akan diterbitkan.
                  </p>
                  <button
                    type="submit"
                    disabled={commitPending}
                    className="app-btn app-btn--primary"
                  >
                    {commitPending ? "Menerapkan…" : "Terapkan penugasan"}
                  </button>
                </div>
              </form>
            ) : (
              <p className="assignment-planner__summary text-[var(--muted)]">
                Tidak ada tugas baru yang perlu diterbitkan.
              </p>
            )}
          </div>
          {commitState.error && (
            <p role="alert" className="assignment-planner__message text-[var(--danger)]">
              {commitState.error}
            </p>
          )}
          {commitState.committed && (
            <p className="assignment-planner__message text-[var(--success)]">
              Penugasan diterapkan. Lihat daftar tugas di bawah untuk hasilnya.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Hasil pratinjau, dibaca sebagai daftar per objek — bukan tabel berkolom "Calon sah / Sudah ada /
 * Akan ditambah / Kekurangan".
 *
 * Tabel itu memaksa orang mengingat arti enam kolom sekaligus, memecah satu objek menjadi dua baris
 * yang berjauhan (Pimpinan dan Selain Pimpinan), dan tetap tidak muat di layar sehingga harus
 * digeser ke samping. Di sini tiap objek berdiri sendiri, tiap kelompok penilainya satu baris, dan
 * angkanya ditulis sebagai kalimat: berapa yang ditambahkan, dari berapa calon, dan apakah
 * targetnya tercapai.
 */
function RencanaTugas({ plan }: { plan: NonNullable<PreviewState["plan"]> }) {
  // Dua baris milik satu objek dikumpulkan; urutan objek mengikuti urutan pertama kali muncul.
  const perObjek = new Map<string, { nama: string; baris: typeof plan.entries }>();
  for (const e of plan.entries) {
    const objek = perObjek.get(e.categoryObjectId) ?? { nama: e.objectName, baris: [] };
    objek.baris.push(e);
    perObjek.set(e.categoryObjectId, objek);
  }
  const kurang = plan.entries.filter((e) => e.shortage > 0).length;

  return (
    <div className="rencana-tugas">
      <p className="rencana-tugas__ringkas">
        {plan.totalNewAssignments > 0
          ? `${plan.totalNewAssignments} tugas baru untuk ${perObjek.size} objek.`
          : "Tidak ada tugas baru yang perlu diterbitkan."}{" "}
        {kurang > 0 ? (
          <span className="rencana-tugas__ringkas-kurang">
            {kurang} kelompok belum mencapai target karena calonnya habis.
          </span>
        ) : (
          "Semua target penilai terpenuhi."
        )}
      </p>

      <ul className="rencana-tugas__daftar">
        {[...perObjek.entries()].map(([id, objek]) => (
          <li key={id} className="rencana-tugas__objek">
            <p className="rencana-tugas__nama">{objek.nama}</p>
            <ul className="rencana-tugas__kelompok">
              {objek.baris.map((e) => (
                <li key={e.group} className="rencana-tugas__baris">
                  <span className="rencana-tugas__label">{groupLabel[e.group]}</span>
                  <span className="rencana-tugas__isi">
                    {e.picked.length > 0 ? (
                      <>
                        <strong>{e.picked.length} penilai ditambahkan:</strong>{" "}
                        {e.picked.map((p) => p.name).join(", ")}
                      </>
                    ) : (
                      <span className="rencana-tugas__kosong">Tidak ada penilai baru yang ditambahkan</span>
                    )}
                    <span className="rencana-tugas__meta">
                      Target {e.target} penilai · {e.alreadyAssigned.length} sudah bertugas ·{" "}
                      {e.eligibleCount} calon memenuhi syarat
                      <Info>{KET.calonSah}</Info>
                    </span>
                  </span>
                  <span className="rencana-tugas__status">
                    {e.shortage > 0 ? (
                      <StatusPill tone="perhatian">
                        Kurang {e.shortage}
                        <Info>{KET.kekurangan}</Info>
                      </StatusPill>
                    ) : (
                      <StatusPill tone="selesai">Target tercapai</StatusPill>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
