import type { AccessMode, PeriodStatus } from "@/generated/prisma/enums";

interface AccessCheckInput {
  mode: AccessMode;
  availableAt: Date | null;
  periodStatus: PeriodStatus;
}

// Bab 4.3: "Waktu akses berlaku pada hasil pimpinan, termasuk Dekan ... Admin tidak terhalang
// jadwal akses hasil." Dipanggil HANYA untuk pemirsa non-Admin — pemanggil bertanggung jawab
// melewati pemeriksaan ini sepenuhnya untuk Admin (Bab 4.1: "Admin ... akses seluruh fakultas").
export function isResultAccessOpenForNonAdmin(input: AccessCheckInput): boolean {
  switch (input.mode) {
    case "SELAMA_AKTIF":
      return input.periodStatus === "AKTIF" || input.periodStatus === "DITUTUP" || input.periodStatus === "FINAL" || input.periodStatus === "REVISI";
    case "SETELAH_DITUTUP":
      return input.periodStatus === "DITUTUP" || input.periodStatus === "FINAL" || input.periodStatus === "REVISI";
    case "SETELAH_FINAL":
      return input.periodStatus === "FINAL";
    case "WAKTU_TERTENTU":
      return !!input.availableAt && new Date() >= input.availableAt;
    default:
      return false;
  }
}

const modeLabel: Record<AccessMode, string> = {
  SELAMA_AKTIF: "selama periode aktif",
  SETELAH_DITUTUP: "setelah periode ditutup",
  SETELAH_FINAL: "setelah periode difinalkan",
  WAKTU_TERTENTU: "pada waktu yang dijadwalkan",
};

export function describeAccessCondition(mode: AccessMode, availableAt: Date | null): string {
  if (mode === "WAKTU_TERTENTU" && availableAt) {
    return `Hasil akan dapat dilihat mulai ${new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(availableAt)}.`;
  }
  return `Hasil dapat dilihat ${modeLabel[mode]}.`;
}
