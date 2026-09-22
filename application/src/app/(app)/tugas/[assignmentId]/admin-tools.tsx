"use client";

import { useAksi } from "@/components/theme/notifikasi";
import { reopenAssignmentAction, voidResponseAction } from "@/lib/actions/responses";
import type { AssignmentStatus } from "@/generated/prisma/enums";
import { useAdminEdit } from "./admin-edit-context";

export function AdminTools({
  assignmentId,
  status,
  effectiveRevisionId,
}: {
  assignmentId: string;
  status: AssignmentStatus;
  effectiveRevisionId: string | null;
}) {
  const sudahTerkirim = status === "TERKIRIM";
  const bisaDibuka = sudahTerkirim || status === "BELUM_MULAI" || status === "DRAF";
  const [reopenState, reopenAction, reopenPending] = useAksi(
    reopenAssignmentAction,
    {},
    sudahTerkirim ? "Tugas dibuka kembali untuk koreksi." : "Pengisian terlambat dibuka."
  );
  const [voidState, voidAction, voidPending] = useAksi(voidResponseAction, {}, "Respons dibatalkan.");
  const { editing, mulai } = useAdminEdit();

  return (
    <div className="admin-tools form">
      {/* Tiap tindakan tertutup sampai diminta. Ketiganya jarang dipakai dan dua di antaranya
          merusak keadaan tugas, jadi isiannya tidak perlu terbuka permanen — cukup namanya dan
          satu kalimat akibatnya, seperti daftar isi. <details> dipakai apa adanya supaya papan
          ketik dan pembaca layar mendapat perilaku buka-tutup tanpa kode tambahan. */}
      <div className="admin-actions">
        {bisaDibuka && (
          <details className="admin-actions__row">
            <summary className="admin-actions__summary">
              <span className="admin-actions__name">
                <strong>{sudahTerkirim ? "Buka kembali" : "Buka pengisian terlambat"}</strong>
                <span>
                  {sudahTerkirim
                    ? "Penilai dapat mengisi ulang sampai tenggat koreksi."
                    : "Penilai dapat mengirim jawaban yang belum sempat diisi sampai tenggat ini."}
                </span>
              </span>
            </summary>
            <form action={reopenAction} className="admin-actions__body">
              <input type="hidden" name="assignmentId" value={assignmentId} />
              <div className="admin-actions__fields">
                <label className="admin-tools__field">
                  <span>{sudahTerkirim ? "Tenggat koreksi (WIB)" : "Tenggat pengisian (WIB)"}</span>
                  <input
                    aria-label="Tenggat koreksi"
                    type="datetime-local"
                    name="correctionEndsAt"
                    required
                    className="form__control"
                  />
                </label>
                <label className="admin-tools__field admin-tools__field--grow">
                  <span>Alasan</span>
                  <input
                    name="reason"
                    placeholder={sudahTerkirim ? "Alasan pembukaan kembali" : "Alasan memberi kesempatan terlambat"}
                    required
                    className="form__control"
                  />
                </label>
              </div>
              <div className="admin-actions__run">
                <button
                  type="submit"
                  disabled={reopenPending}
                  className="admin-action admin-action--primary"
                >
                  {reopenPending ? "Memproses…" : sudahTerkirim ? "Buka kembali" : "Buka pengisian"}
                </button>
              </div>
              {reopenState.error && (
                <p role="alert" className="admin-actions__error">
                  {reopenState.error}
                </p>
              )}
            </form>
          </details>
        )}

        <details className="admin-actions__row">
          <summary className="admin-actions__summary">
            <span className="admin-actions__name">
              <strong>Koreksi skor</strong>
              <span>Mengubah skor tanpa membuka pengisian bagi penilai.</span>
            </span>
          </summary>
          <div className="admin-actions__body">
            <div className="admin-actions__fields">
              <p className="admin-actions__note">
                Skornya diketik di lembar Instrumen Penilaian di atas halaman ini. Koreksi tersimpan
                sebagai revisi terkirim baru — bukan draf — dan tercatat di jejak audit.
              </p>
            </div>
            <div className="admin-actions__run">
              <button type="button" onClick={mulai} className="admin-action" disabled={editing}>
                {editing ? "Sedang dikoreksi" : "Koreksi di lembar penilaian"}
              </button>
            </div>
          </div>
        </details>

        {status === "TERKIRIM" && effectiveRevisionId && (
          <details className="admin-actions__row">
            <summary className="admin-actions__summary">
              <span className="admin-actions__name">
                <strong>Batalkan jawaban</strong>
                <span>Jawaban dikeluarkan dari agregasi; riwayatnya tetap tersimpan.</span>
              </span>
            </summary>
            <form action={voidAction} className="admin-actions__body">
              <input type="hidden" name="assignmentId" value={assignmentId} />
              <input type="hidden" name="responseRevisionId" value={effectiveRevisionId} />
              <div className="admin-actions__fields">
                <label className="admin-tools__field admin-tools__field--grow">
                  <span>Alasan</span>
                  <input
                    name="reason"
                    placeholder="Alasan pembatalan jawaban"
                    required
                    className="form__control"
                  />
                </label>
              </div>
              <div className="admin-actions__run">
                <button
                  type="submit"
                  disabled={voidPending}
                  className="admin-action admin-action--danger"
                >
                  {voidPending ? "Memproses…" : "Batalkan"}
                </button>
              </div>
              {voidState.error && (
                <p role="alert" className="admin-actions__error">
                  {voidState.error}
                </p>
              )}
            </form>
          </details>
        )}
      </div>
    </div>
  );
}
