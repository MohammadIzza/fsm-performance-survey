export function initForms() {
  const endpoint = import.meta.env.PUBLIC_FORM_ENDPOINT?.trim();
  document
    .querySelectorAll<HTMLFormElement>('[data-contact-form]')
    .forEach((form) => {
      const button = form.querySelector<HTMLButtonElement>('[type="submit"]');
      const status = form.querySelector<HTMLElement>('.form-status');
      if (!button || !status) return;
      button.disabled = false;
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;
        if (!endpoint) {
          status.textContent =
            'Pratinjau saja: validasi lolos. Tidak ada data yang dikirim. Hubungi survei.fsm@undip.ac.id untuk mengajukan akses.';
          return;
        }
        button.disabled = true;
        form.setAttribute('aria-busy', 'true');
        status.textContent = 'Mengirim…';
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              formId: form.dataset.formId,
              page: location.pathname,
              fields: Object.fromEntries(new FormData(form)),
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) throw new Error('Submission rejected');
          status.textContent = 'Terima kasih. Permintaan Anda telah dikirim.';
          form.reset();
        } catch {
          status.textContent =
            'Gagal mengirim. Isian Anda tetap tersimpan. Coba lagi atau hubungi survei.fsm@undip.ac.id.';
        } finally {
          button.disabled = false;
          form.removeAttribute('aria-busy');
        }
      });
    });
}
