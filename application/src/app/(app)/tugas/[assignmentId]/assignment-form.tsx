"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  adminEditResponseAction,
  saveDraftAction,
  submitResponseAction,
  type FormState,
} from "@/lib/actions/responses";
import { ThemeButton } from "@/components/theme-button";
import { useKonfirmasi } from "@/components/theme/confirm-dialog";
import { SHEET_ID, useAdminEdit } from "./admin-edit-context";

interface ParameterView {
  id: string;
  name: string;
  indicator: string | null;
  weight: number;
  order: number;
}

interface Scale {
  min: number;
  max: number;
  step: number;
}

const draftInitial: FormState = {};
const submitInitial: FormState = {};
const adminEditInitial: FormState = {};

function ScoreField({
  id,
  label,
  scale,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  scale: Scale;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  // Atribut min/max pada input angka hanya diperiksa peramban saat formulir dikirim — selama
  // mengetik, "1999" tetap masuk, nilai bobot dan total ikut melonjak (199,9 dan 240,5), dan
  // penolakannya baru datang dari server. Di sini nilai di luar skala tidak pernah diterima: ketikan
  // yang membuatnya keluar batas dibatalkan (angka sebelumnya tetap) dan batasnya disebutkan.
  const [peringatan, setPeringatan] = useState<string | null>(null);
  const tenggatPeringatan = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bilanganBulat = Number.isInteger(scale.step) && scale.step >= 1;
  const bolehNegatif = scale.min < 0;

  useEffect(() => () => {
    if (tenggatPeringatan.current) clearTimeout(tenggatPeringatan.current);
  }, []);

  function ingatkan(pesan: string) {
    setPeringatan(pesan);
    if (tenggatPeringatan.current) clearTimeout(tenggatPeringatan.current);
    tenggatPeringatan.current = setTimeout(() => setPeringatan(null), 2600);
  }

  function ubah(mentah: string) {
    if (mentah === "") {
      onChange("");
      return;
    }
    const angka = Number(mentah);
    if (!Number.isFinite(angka)) return;
    if (angka > scale.max) return ingatkan(`Maksimal ${displayNumber(scale.max)}`);
    if (angka < scale.min) return ingatkan(`Minimal ${displayNumber(scale.min)}`);
    if (scale.step > 0) {
      const langkah = (angka - scale.min) / scale.step;
      if (Math.abs(langkah - Math.round(langkah)) > 1e-6) {
        return ingatkan(bilanganBulat ? "Bilangan bulat" : `Kelipatan ${displayNumber(scale.step)}`);
      }
    }
    setPeringatan(null);
    onChange(mentah);
  }

  const idPeringatan = `${id}-batas`;
  return (
    <label className="assessment-score-control" htmlFor={id}>
      <span className="sr-only">{label}</span>
      <input
        id={id}
        type="number"
        inputMode={bilanganBulat && !bolehNegatif ? "numeric" : "decimal"}
        min={scale.min}
        max={scale.max}
        step={scale.step || "any"}
        value={value}
        disabled={disabled}
        placeholder="—"
        aria-invalid={peringatan ? true : undefined}
        aria-describedby={peringatan ? idPeringatan : undefined}
        // Tombol yang tidak pernah menghasilkan skor sah ditolak sejak ditekan: notasi eksponen
        // (e), tanda plus, tanda minus bila skala tidak negatif, dan koma/titik bila skalanya
        // bilangan bulat. Papan ketik virtual yang tidak melaporkan tombolnya tetap tertangani ubah().
        onKeyDown={(e) => {
          const ditolak =
            e.key === "e" ||
            e.key === "E" ||
            e.key === "+" ||
            (e.key === "-" && !bolehNegatif) ||
            (bilanganBulat && (e.key === "." || e.key === ","));
          if (ditolak) {
            e.preventDefault();
            ingatkan(
              e.key === "." || e.key === ","
                ? "Bilangan bulat"
                : `Skor ${displayNumber(scale.min)}–${displayNumber(scale.max)}`
            );
          }
        }}
        onChange={(e) => ubah(e.target.value)}
        // Roda tetikus di atas input angka yang terfokus diam-diam mengubah skornya.
        onWheel={(e) => e.currentTarget.blur()}
        className="tap-target"
      />
      <span id={idPeringatan} className="assessment-score-control__batas" role="status" aria-live="polite">
        {peringatan}
      </span>
    </label>
  );
}

function displayNumber(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);
}

function AssessmentSheet({
  parameters,
  scale,
  scores,
  guide,
  editable,
  onScoreChange,
  adminEditing = false,
}: {
  parameters: ParameterView[];
  scale: Scale;
  scores: Record<string, string>;
  guide: string | null;
  editable: boolean;
  onScoreChange?: (parameterId: string, value: string) => void;
  adminEditing?: boolean;
}) {
  const filledCount = parameters.filter((p) => scores[p.id] !== "").length;
  const totalWeight = parameters.reduce((sum, p) => sum + p.weight, 0);
  const totalScore = parameters.reduce((sum, p) => {
    const score = Number(scores[p.id]);
    return sum + (Number.isFinite(score) ? score * p.weight / 100 : 0);
  }, 0);

  return (
    <section
      id={SHEET_ID}
      className={`assessment-sheet${adminEditing ? " assessment-sheet--admin-edit" : ""}`}
      aria-labelledby="assessment-title"
    >
      <header className="assessment-sheet__intro">
        <div>
          <p className="eyebrow">INSTRUMEN PENILAIAN</p>
          <h2 id="assessment-title">Isi skor setiap parameter</h2>
          {guide && <p>{guide}</p>}
        </div>
      </header>

      {/* Penanda mode koreksi duduk di dalam lembarnya, di atas kepala tabel: satu-satunya tempat
          yang pasti terlihat saat halaman digulir ke sini dari tombol di alat admin. */}
      {adminEditing && (
        <p className="assessment-sheet__mode" role="status">
          <span>Mode koreksi admin</span>
          Skor di bawah ini sedang diubah sebagai admin. Simpan untuk menyimpannya sebagai revisi
          terkirim baru, atau batalkan untuk keluar tanpa mengubah apa pun.
        </p>
      )}

      <div className="assessment-grid">
        <div className="assessment-grid__head" aria-hidden="true">
          <span>No.</span>
          <span>Parameter</span>
          <span>Indikator operasional</span>
          <span>Bobot</span>
          <span>Skor {scale.min}–{scale.max}</span>
          <span>Nilai bobot</span>
        </div>

        <div className="assessment-grid__body">
          {parameters.map((p, idx) => {
            const rawValue = scores[p.id] ?? "";
            const numericValue = Number(rawValue);
            const weightedValue =
              rawValue !== "" && Number.isFinite(numericValue)
                ? displayNumber(numericValue * p.weight / 100)
                : "—";

            return (
              <div className="assessment-question" key={p.id}>
                {editable && (
                  <>
                    <input type="hidden" name="parameterId" value={p.id} />
                    <input type="hidden" name="scoreValue" value={rawValue} />
                  </>
                )}
                <span className="assessment-question__number">{idx + 1}</span>
                <div className="assessment-question__parameter">
                  <span className="assessment-cell-label">Parameter</span>
                  <strong>{p.name}</strong>
                </div>
                <div className="assessment-question__indicator">
                  <span className="assessment-cell-label">Indikator operasional</span>
                  <span>{p.indicator || "Tidak ada indikator tambahan."}</span>
                </div>
                <div className="assessment-question__weight">
                  <span className="assessment-cell-label">Bobot</span>
                  <strong>{p.weight}%</strong>
                </div>
                <div className="assessment-question__score">
                  <span className="assessment-cell-label">Skor</span>
                  <ScoreField
                    id={`score-${p.id}`}
                    label={`Skor untuk ${p.name}`}
                    scale={scale}
                    value={rawValue}
                    onChange={(value) => onScoreChange?.(p.id, value)}
                    disabled={!editable}
                  />
                </div>
                <div className="assessment-question__weighted">
                  <span className="assessment-cell-label">Nilai bobot</span>
                  <output>{weightedValue}</output>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="assessment-grid__total">
          <strong>Total nilai saat ini</strong>
          <span>{displayNumber(totalWeight)}%</span>
          <output>{filledCount ? displayNumber(totalScore) : "—"}</output>
        </footer>
      </div>
    </section>
  );
}

export function AssignmentForm({
  assignmentId,
  parameters,
  scale,
  guide,
  canEdit,
  isLocked,
  initialScores,
  initialVersion,
  effectiveInfo,
}: {
  assignmentId: string;
  parameters: ParameterView[];
  scale: Scale;
  guide: string | null;
  canEdit: boolean;
  isLocked: boolean;
  initialScores: Record<string, number>;
  // null = belum ada draf sebelumnya (tugas baru); server memperlakukan null sebagai "tanpa
  // konflik yang mungkin". Setelah simpan pertama, versi baru dari respons aksi dipakai sebagai
  // basis berikutnya (Bab 6.2/EDGE-12) — lihat expectedVersion di bawah.
  initialVersion: number | null;
  effectiveInfo: { submittedAt: string; revision: number } | null;
}) {
  const [draftState, draftAction, draftPending] = useActionState(saveDraftAction, draftInitial);
  const [submitState, submitAction, submitPending] = useActionState(submitResponseAction, submitInitial);
  const [adminState, adminAction, adminPending] = useActionState(
    adminEditResponseAction,
    adminEditInitial
  );
  const { editing: adminEditing, selesai: selesaiKoreksi } = useAdminEdit();
  const expectedVersion = draftState.version ?? initialVersion;
  // Kunci idempotensi dibuat sekali per pemuatan halaman (bukan saat render, Bab 11.4/EDGE-11).
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${performance.now()}`
  );
  // Ref murni untuk pemberitahuan sebelum-tutup (Bab 11.3); tidak memicu render, jadi aman
  // ditulis dari event handler dan dibaca dari listener tanpa melanggar aturan kemurnian render.
  const dirtyRef = useRef(false);
  const [konfirmasi, dialogKonfirmasi] = useKonfirmasi();

  const sortedParameters = parameters.slice().sort((a, b) => a.order - b.order);

  // Nilai tiap parameter dikelola sebagai state terkontrol agar widget skala kustom (tombol bulat
  // / slider) bisa dipakai, sementara nilai yang benar-benar terkirim tetap lewat input hidden
  // bernama "scoreValue" — urutan & pasangan dengan "parameterId" tidak berubah dari sebelumnya,
  // jadi lapisan server (parsing FormData berbasis array paralel) tidak perlu disentuh.
  const [scores, setScores] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of sortedParameters) {
      init[p.id] = initialScores[p.id] != null ? String(initialScores[p.id]) : "";
    }
    return init;
  });

  // Batal harus mengembalikan angka yang tampil ke keadaan tersimpan. Tanpa ini lembar yang
  // terkunci tetap memperlihatkan ketikan yang barusan dibuang — angka yang tidak pernah
  // disimpan, tetapi terbaca sebagai nilai resmi. Ref dipakai, bukan dependensi efek, supaya
  // potretnya diambil tepat saat mode koreksi menyala dan bukan setiap kali satu angka berubah.
  const scoresTerkini = useRef(scores);
  scoresTerkini.current = scores;
  const scoresSebelumKoreksi = useRef<Record<string, string> | null>(null);
  useEffect(() => {
    scoresSebelumKoreksi.current = adminEditing ? scoresTerkini.current : null;
  }, [adminEditing]);

  function batalkanKoreksi() {
    if (scoresSebelumKoreksi.current) setScores(scoresSebelumKoreksi.current);
    selesaiKoreksi();
  }

  // Aksi mengembalikan objek baru setiap kali dijalankan, jadi identitas objeknya cukup untuk
  // membedakan "belum pernah dikirim" dari "sudah dikirim": kalau bukan nilai awal dan tidak
  // membawa galat, koreksinya tersimpan dan mode koreksi ditutup sendiri.
  useEffect(() => {
    if (adminState !== adminEditInitial && !adminState.error) selesaiKoreksi();
  }, [adminState, selesaiKoreksi]);

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Mode koreksi admin menggantikan kedua tampilan di bawah: lembar yang sama, tetapi skornya
  // dapat diketik dan terkirim ke aksi admin, bukan ke draf/kirim milik penilai.
  if (adminEditing) {
    return (
      <form action={adminAction} className="assignment-form assignment-form--admin-edit">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <AssessmentSheet
          parameters={sortedParameters}
          scale={scale}
          scores={scores}
          guide={guide}
          editable
          adminEditing
          onScoreChange={(parameterId, value) =>
            setScores((current) => ({ ...current, [parameterId]: value }))
          }
        />
        <div className="assessment-actions assessment-actions--admin">
          <label className="admin-tools__field admin-tools__field--grow">
            <span>Alasan koreksi (wajib)</span>
            <input
              name="reason"
              placeholder="Mis. salah ketik pada parameter 2"
              required
              className="form__control"
            />
          </label>
          <div className="assessment-actions__buttons">
            <button
              type="button"
              onClick={batalkanKoreksi}
              disabled={adminPending}
              className="admin-action"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={adminPending}
              className="admin-action admin-action--primary"
            >
              {adminPending ? "Menyimpan…" : "Simpan koreksi"}
            </button>
          </div>
          {adminState.error && (
            <p role="alert" className="admin-actions__error">
              {adminState.error}
            </p>
          )}
        </div>
      </form>
    );
  }

  if (isLocked) {
    return (
      <div className="assignment-form assignment-form--locked space-y-4">
        {/* Kalimat "Terkirim pada ... (revisi n)" dihapus: kartu Status di kepala halaman sudah
            menyatakan keadaan tugasnya, dan baris ini mengulanginya tepat di bawahnya. Kalimat
            untuk keadaan belum dinilai tetap ada karena tidak ada tempat lain yang menyatakannya. */}
        {!effectiveInfo && (
          <p className="app-text-sm text-[var(--muted)]">Belum ada penilaian.</p>
        )}
        <AssessmentSheet
          parameters={sortedParameters}
          scale={scale}
          scores={scores}
          guide={guide}
          editable={false}
        />
      </div>
    );
  }

  return (
    <form
      action={draftAction}
      onChange={() => {
        dirtyRef.current = true;
      }}
      onSubmit={() => {
        dirtyRef.current = false;
      }}
      className="assignment-form space-y-5"
    >
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="expectedVersion" value={expectedVersion ?? ""} />

      <AssessmentSheet
        parameters={sortedParameters}
        scale={scale}
        scores={scores}
        guide={guide}
        editable={canEdit}
        onScoreChange={(parameterId, value) =>
          setScores((current) => ({ ...current, [parameterId]: value }))
        }
      />

      {canEdit && (
        <div className="assessment-actions">
          {/* Urutan disengaja: aksi aman/reversibel (Simpan draf) lebih dulu, aksi final yang
              mengunci jawaban (Kirim) di bawahnya — mengurangi risiko ketuk keliru di layar
              sentuh, tetap dijaga dialog konfirmasi sebagai lapis kedua. */}
          <button
            type="submit"
            disabled={draftPending || submitPending}
            className="assessment-actions__draft tap-target"
          >
            {draftPending ? "Menyimpan…" : "Simpan draf"}
          </button>
          <ThemeButton
            type="submit"
            formAction={submitAction}
            disabled={draftPending || submitPending}
            className="assessment-actions__submit"
            onClick={async (e) => {
              // Pengiriman ditahan sampai dikonfirmasi di dialog, lalu dijalankan ulang dengan
              // tombol ini sebagai pengirim — requestSubmit(tombol) membawa formAction-nya dan
              // tidak memicu onClick ini lagi.
              e.preventDefault();
              const tombol = e.currentTarget;
              const kosong = sortedParameters.filter((p) => scores[p.id] === "").length;
              if (kosong > 0) {
                // Server menolak jawaban yang belum lengkap; lebih jelas disampaikan sekarang
                // daripada lewat pesan galat setelah mengirim.
                await konfirmasi({
                  label: "Belum bisa dikirim",
                  judul: "Masih ada parameter kosong",
                  pesan: (
                    <p>
                      {kosong} dari {sortedParameters.length} parameter belum diberi skor. Lengkapi
                      seluruh parameter, lalu kirim lagi.
                    </p>
                  ),
                  tombolBatal: "Kembali mengisi",
                });
                return;
              }
              const ya = await konfirmasi({
                label: "Kirim penilaian",
                judul: "Kirim jawaban sekarang?",
                pesan: (
                  <p>
                    Seluruh {sortedParameters.length} parameter sudah terisi. Setelah dikirim,
                    jawaban terkunci dan tidak dapat diubah sendiri — perubahan hanya lewat admin.
                  </p>
                ),
                tombolYa: "Kirim jawaban",
                tombolBatal: "Periksa lagi",
              });
              if (ya) tombol.form?.requestSubmit(tombol);
            }}
          >
            {submitPending ? "Mengirim…" : "Kirim jawaban"}
          </ThemeButton>
          {draftState.savedAt && (
            <span className="order-3 text-center app-text-xs text-[var(--success)] sm:text-left">
              Tersimpan {new Date(draftState.savedAt).toLocaleTimeString("id-ID")}
            </span>
          )}
          {(draftState.error || submitState.error) && (
            <div className="w-full">
              <p role="alert" className="text-sm text-[var(--danger)]">
                {draftState.error || submitState.error}
              </p>
              {(draftState.error ?? submitState.error ?? "").includes("berubah sejak") && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-1 app-text-sm font-medium text-[var(--accent)] hover:underline"
                >
                  Muat ulang halaman
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {dialogKonfirmasi}
    </form>
  );
}
