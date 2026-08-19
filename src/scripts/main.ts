// Menu, dialogs, sliders, and media are handled by the theme runtime
// (GSAP + Luge + main.js) loaded in SiteLayout. Only form submission is ours,
// because the original relied on a WordPress Contact Form 7 backend.
import { initForms } from './forms';

initForms();
