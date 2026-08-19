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
            'Preview only: validation passed. Nothing was sent. Contact info@nodcoding.com to apply.';
          return;
        }
        button.disabled = true;
        form.setAttribute('aria-busy', 'true');
        status.textContent = 'Sending…';
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
          status.textContent = 'Thank you. Your request has been sent.';
          form.reset();
        } catch {
          status.textContent =
            'Unable to send. Your entries have been kept. Please try again or contact info@nodcoding.com.';
        } finally {
          button.disabled = false;
          form.removeAttribute('aria-busy');
        }
      });
    });
}
