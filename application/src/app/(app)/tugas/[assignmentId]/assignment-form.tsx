"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  saveDraftAction,
  submitResponseAction,
  type FormState,
} from "@/lib/actions/responses";
import { ThemeButton } from "@/components/theme-button";

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
  return (
    <label className="assessment-score-control" htmlFor={id}>
      <span className="sr-only">{label}</span>
      <input
        id={id}
        type="number"
        min={scale.min}
        max={scale.max}
        step={scale.step || "any"}
        value={value}
        disabled={disabled}
        placeholder="—"
        onChange={(e) => onChange(e.target.value)}
        className="tap-target"
      />
      <span aria-hidden="true">{scale.min}–{scale.max}</span>
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
}: {
  parameters: ParameterView[];
  scale: Scale;
  scores: Record<string, string>;
  guide: string | null;
  editable: boolean;
  onScoreChange?: (parameterId: string, value: string) => void;
}) {
  const filledCount = parameters.filter((p) => scores[p.id] !== "").length;
  const totalWeight = parameters.reduce((sum, p) => sum + p.weight, 0);
  const totalScore = parameters.reduce((sum, p) => {
    const score = Number(scores[p.id]);
    return sum + (Number.isFinite(score) ? score * p.weight / 100 : 0);
  }, 0);

  return (
    <section className="assessment-sheet" aria-labelledby="assessment-title">
      <header className="assessment-sheet__intro">
        <div>
          <p className="eyebrow">INSTRUMEN PENILAIAN</p>
          <h2 id="assessment-title">Isi skor setiap parameter</h2>
          {guide && <p>{guide}</p>}
        </div>
      </header>

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
  const expectedVersion = draftState.version ?? initialVersion;
  // Kunci idempotensi dibuat sekali per pemuatan halaman (bukan saat render, Bab 11.4/EDGE-11).
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${performance.now()}`
  );
  // Ref murni untuk pemberitahuan sebelum-tutup (Bab 11.3); tidak memicu render, jadi aman
  // ditulis dari event handler dan dibaca dari listener tanpa melanggar aturan kemurnian render.
  const dirtyRef = useRef(false);

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

  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  if (isLocked) {
    return (
      <div className="assignment-form assignment-form--locked space-y-4">
        {/* Kalimat "Terkirim pada ... (revisi n)" dihapus: kartu Status di kepala halaman sudah
            menyatakan keadaan tugasnya, dan baris ini mengulanginya tepat di bawahnya. Kalimat
            untuk keadaan belum dinilai tetap ada karena tidak ada tempat lain yang menyatakannya. */}
        {!effectiveInfo && (
          <p className="text-[13px] text-[var(--muted)]">Belum ada penilaian.</p>
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
            onClick={(e) => {
              if (!confirm("Kirim jawaban? Lengkapi seluruh parameter sebelum mengirim.")) {
                e.preventDefault();
              }
            }}
          >
            {submitPending ? "Mengirim…" : "Kirim jawaban"}
          </ThemeButton>
          {draftState.savedAt && (
            <span className="order-3 text-center text-[12px] text-[var(--success)] sm:text-left">
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
                  className="mt-1 text-[13px] font-medium text-[var(--accent)] hover:underline"
                >
                  Muat ulang halaman
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
