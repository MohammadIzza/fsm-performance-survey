import { SSO_LOGIN_URL } from "@/lib/sso";

// Markah disalin dari ThemeButton (src/components/theme-button.tsx) supaya tampilannya sama persis
// — tapi ini tautan biasa ke luar aplikasi, bukan tombol formulir, jadi <a>, bukan <button>.
export function SsoLoginButton() {
  return (
    <a href={SSO_LOGIN_URL} className="btn-plain btn-plain--primary survey-login-submit">
      <span className="btn-plain__inner">
        <svg
          viewBox="0 0 10 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="btn-plain__background"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M 0 0 L 10 0 L 10 10 L 0 10" className="btn-plain__path" />
          <path d="M 0 0 L 10 0 L 10 10 L 0 10" className="btn-plain__path" />
        </svg>
        <span className="btn-plain__text">Login dengan SSO FSM</span>
        <span className="btn-plain__arrow" />
      </span>
    </a>
  );
}
