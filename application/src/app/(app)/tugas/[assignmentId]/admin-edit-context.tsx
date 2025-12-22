"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Koreksi admin memakai lembar penilaian di atas halaman, bukan form kedua di bawahnya: hanya ada
// satu tempat di halaman ini tempat skor diketik, apa pun perannya. Alat admin dan lembar itu dua
// komponen bersaudara di bawah satu halaman server, jadi keadaan "sedang dikoreksi" dititipkan di
// context ini — satu-satunya hal yang perlu mereka sepakati.
interface AdminEditValue {
  editing: boolean;
  /** Menyalakan mode koreksi lalu membawa layar ke lembar penilaian. */
  mulai: () => void;
  selesai: () => void;
}

const AdminEditContext = createContext<AdminEditValue>({
  editing: false,
  mulai: () => {},
  selesai: () => {},
});

export const SHEET_ID = "lembar-penilaian";

export function AdminEditProvider({ children }: { children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);

  const mulai = useCallback(() => {
    setEditing(true);
    // Lembar penilaian berada jauh di atas alat admin. Tanpa ini tombolnya tampak tidak berbuat
    // apa-apa: mode koreksi menyala di luar layar. Dijadwalkan setelah render supaya yang digulir
    // adalah tata letak yang sudah memuat penanda mode koreksi.
    requestAnimationFrame(() => {
      document.getElementById(SHEET_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const selesai = useCallback(() => setEditing(false), []);

  const value = useMemo(() => ({ editing, mulai, selesai }), [editing, mulai, selesai]);
  return <AdminEditContext.Provider value={value}>{children}</AdminEditContext.Provider>;
}

export function useAdminEdit() {
  return useContext(AdminEditContext);
}
