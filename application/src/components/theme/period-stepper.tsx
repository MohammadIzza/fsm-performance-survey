import Link from "next/link";
import type { ReactNode } from "react";

export type PeriodStepState = "done" | "current" | "todo";

export interface PeriodStep {
  title: string;
  description: string;
  note: string;
  href: string;
  state: PeriodStepState;
  content?: ReactNode;
}

const stateLabel: Record<PeriodStepState, string> = {
  done: "Selesai",
  current: "Kerjakan sekarang",
  todo: "Berikutnya",
};

/**
 * Petunjuk kerja yang dibaca sebagai urutan pekerjaan admin, bukan sebagai istilah internal
 * sistem. Setiap langkah adalah tautan penuh seperti baris pada Tugas Saya, sehingga pengguna
 * dapat langsung berpindah ke pekerjaan yang harus diselesaikan.
 */
export function PeriodStepper({ steps }: { steps: PeriodStep[] }) {
  const completed = steps.filter((step) => step.state === "done").length;
  const currentIndex = steps.findIndex((step) => step.state === "current");
  const progress = currentIndex === -1 ? 100 : Math.round((completed / steps.length) * 100);

  return (
    <section className="period-stepper" aria-labelledby="period-stepper-title">
      <div className="period-stepper__heading">
        <div>
          <p className="eyebrow">Panduan pengerjaan</p>
          <h2 id="period-stepper-title">Selesaikan periode langkah demi langkah</h2>
          <p>
            {currentIndex === -1
              ? "Semua langkah sudah selesai."
              : `Sekarang langkah ${currentIndex + 1} dari ${steps.length}. Pilih langkah untuk melanjutkan.`}
          </p>
        </div>
        <strong>{progress}%</strong>
      </div>

      <div
        className="period-stepper__progress"
        role="progressbar"
        aria-label="Progres penyiapan periode"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span style={{ width: `${progress}%` }} />
      </div>

      <ol className="period-stepper__list">
        {steps.map((step, index) => {
          const summary = (
            <>
              <span className="period-stepper__number" aria-hidden="true">
                {step.state === "done" ? "✓" : index + 1}
              </span>
              <span className="period-stepper__content">
                <span className="period-stepper__state">{stateLabel[step.state]}</span>
                <strong>{step.title}</strong>
                <span>{step.description}</span>
                <small>{step.note}</small>
              </span>
              <span className="period-stepper__arrow" aria-hidden="true" />
            </>
          );

          return (
            <li key={step.title} data-state={step.state}>
              {step.state === "todo" ? (
                <div className="period-stepper__summary period-stepper__summary--locked" aria-disabled="true">
                  {summary}
                </div>
              ) : (
                <details
                  open={
                    step.state === "current" ||
                    (currentIndex === -1 && index === steps.length - 1)
                  }
                >
                  <summary
                    className="period-stepper__summary"
                    aria-current={step.state === "current" ? "step" : undefined}
                  >
                    {summary}
                  </summary>
                  <div className="period-stepper__panel">
                    {step.content ?? (
                      <Link href={step.href} className="app-btn app-btn--primary">
                        Buka pengaturan
                      </Link>
                    )}
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
