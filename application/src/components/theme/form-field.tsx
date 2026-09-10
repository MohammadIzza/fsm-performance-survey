import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * Kolom isian memakai komponen formulir tema (`.form`, `.form__row`, `.form__control`,
 * `.form__action`) — bentuk yang sama dipakai bagian pendaftaran di halaman panduan.
 *
 * `.form__control` sudah membawa tinggi, garis tepi, radius, warna teks bantu, dan keadaan fokus
 * dari tema, jadi tidak ada satu pun ukuran atau warna yang ditulis ulang di sini.
 */

export function Form({
  children,
  action,
  className = "",
  ...props
}: React.ComponentProps<"form">) {
  return (
    <form {...props} action={action} className={`form ${className}`.trim()}>
      {children}
    </form>
  );
}

export function FormRow({ children }: { children: ReactNode }) {
  return <div className="form__row">{children}</div>;
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="form__action">{children}</div>;
}

/** Label tema tidak punya kelas sendiri; yang membedakannya adalah skala huruf `.t-t-sm`. */
export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="form__row">
      <label className="t-t-sm" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="t-t-sm">{hint}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`form__control ${props.className ?? ""}`.trim()} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`form__control ${props.className ?? ""}`.trim()} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`form__control ${props.className ?? ""}`.trim()} />;
}
