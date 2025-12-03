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

// Warna aksen bergilir per kartu parameter, dari palet brand yang sama dipakai home page
// (kuning/biru/oranye) — supaya formulir tidak terasa seragam abu-abu dibanding home page.
const accentByIndex = [
  { badge: "bg-[var(--warm-tint)] text-[var(--warm)]", stripe: "bg-[var(--warm-tint)]" },
  { badge: "bg-[var(--accent-tint)] text-[var(--accent)]", stripe: "bg-[var(--accent-tint)]" },
  { badge: "bg-[var(--success-tint)] text-[var(--success)]", stripe: "bg-[var(--success-tint)]" },
  { badge: "bg-[var(--danger-tint)] text-[var(--danger)]", stripe: "bg-[var(--danger-tint)]" },
];

// Gaya "Google Forms": satu pertanyaan = satu kartu berdiri sendiri, judul besar, deskripsi
// (indikator) di bawahnya, dan kontrol jawaban yang besar/mudah disentuh — bukan tabel input
// angka polos yang rapat.
function ScoreField({
  scale,
  value,
  onChange,
  disabled,
}: {
  scale: Scale;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const stepSize = scale.step || 1;
  const stepCount = Math.round((scale.max - scale.min) / stepSize) + 1;
  // Rentang pendek (mis. 1–5, 1–10) ditampilkan sebagai deretan tombol bulat bernomor — persis
  // "linear scale" ala Google Forms. Rentang panjang (mis. 0–100) tidak praktis sebagai tombol
  // satu-satu, jadi dipakai slider + kolom angka untuk penyesuaian presisi.
  const useScaleButtons = Number.isFinite(stepCount) && stepCount >= 2 && stepCount <= 11;

  if (useScaleButtons) {
    const options = Array.from({ length: stepCount }, (_, i) => scale.min + i * stepSize);
    return (
      <div className="assignment-score-buttons flex flex-wrap gap-2">
        {options.map((opt) => {
          const optStr = String(opt);
          const selected = value === optStr;
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => onChange(optStr)}
              aria-pressed={selected}
              className={`tap-target flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-[15px] font-medium transition disabled:cursor-default disabled:opacity-60 ${
                selected
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)]"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="assignment-score-field flex items-center gap-4">
      <input
        type="range"
        min={scale.min}
        max={scale.max}
        step={stepSize}
        value={value === "" ? scale.min : Number(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-2 w-full flex-1 cursor-pointer accent-[var(--accent)] disabled:cursor-default disabled:opacity-60"
      />
      <input
        type="number"
        min={scale.min}
        max={scale.max}
        step={scale.step || "any"}
        value={value}
        disabled={disabled}
        placeholder={`${scale.min}–${scale.max}`}
        onChange={(e) => onChange(e.target.value)}
        className="tap-target w-24 shrink-0 rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-center text-[15px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-60"
      />
    </div>
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
      <div className="space-y-4">
        {effectiveInfo ? (
          <p className="text-[13px] text-[var(--muted)]">
            Terkirim pada {effectiveInfo.submittedAt} (revisi {effectiveInfo.revision}). Jawaban
            sudah dikirim dan dikunci.
          </p>
        ) : (
          <p className="text-[13px] text-[var(--muted)]">Belum ada penilaian.</p>
        )}
        <div className="space-y-3">
          {sortedParameters.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] font-medium text-[var(--foreground)]">{p.name}</p>
                  {p.indicator && <p className="mt-1 text-[12px] text-[var(--muted)]">{p.indicator}</p>}
                </div>
                <span className="shrink-0 text-[17px] font-semibold text-[var(--foreground)]">
                  {initialScores[p.id] ?? "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
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

      {guide && (
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[13px] text-[var(--muted)] shadow-sm">
          {guide}
        </p>
      )}

      <div className="space-y-4">
        {sortedParameters.map((p, idx) => {
          const accent = accentByIndex[idx % accentByIndex.length];
          return (
          <div
            key={p.id}
            className="assignment-parameter relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6"
          >
            <span className={`absolute inset-y-0 left-0 w-1.5 ${accent.stripe}`} aria-hidden="true" />
            <input type="hidden" name="parameterId" value={p.id} />
            <input type="hidden" name="scoreValue" value={scores[p.id] ?? ""} />
            <div className="assignment-parameter__head mb-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${accent.badge}`}
                >
                  {idx + 1}
                </span>
                <div>
                  <p className="text-[16px] font-medium text-[var(--foreground)] sm:text-[17px]">
                    {p.name}
                  </p>
                  {p.indicator && (
                    <p className="mt-1 text-[13px] text-[var(--muted)]">{p.indicator}</p>
                  )}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-black/[0.04] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">
                Bobot {p.weight}%
              </span>
            </div>
            <ScoreField
              scale={scale}
              value={scores[p.id] ?? ""}
              onChange={(v) => setScores((s) => ({ ...s, [p.id]: v }))}
              disabled={!canEdit}
            />
          </div>
          );
        })}
      </div>

      {canEdit && (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Urutan disengaja: aksi aman/reversibel (Simpan draf) lebih dulu, aksi final yang
              mengunci jawaban (Kirim) di bawahnya — mengurangi risiko ketuk keliru di layar
              sentuh, tetap dijaga dialog konfirmasi sebagai lapis kedua. */}
          <button
            type="submit"
            disabled={draftPending || submitPending}
            className="tap-target order-1 w-full rounded-xl border border-[var(--border)] px-4 py-3 text-[15px] font-medium text-[var(--foreground)] transition hover:bg-black/[0.03] disabled:opacity-60 sm:w-auto sm:py-2 sm:text-[14px]"
          >
            {draftPending ? "Menyimpan…" : "Simpan draf"}
          </button>
          <ThemeButton
            type="submit"
            formAction={submitAction}
            disabled={draftPending || submitPending}
            className="order-2 w-full sm:w-auto"
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
