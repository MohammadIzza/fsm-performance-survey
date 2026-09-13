// Bootstrap configuration for the theme runtime (GSAP + Luge + main.js).
// Mirrors the `window.plr` object the WordPress theme printed inline.
//
// `css` is omitted for every bundle on purpose: the theme's per-component
// stylesheets are already merged into `src/styles/theme/`, so letting the
// loader fetch `<tpl_dir>/build/css/components/*.css` would only produce 404s.
// A rejected stylesheet promise aborts `loadControllers()` and stalls site init.
export const themeVersion = '530810264';

export const themeBundles = {
  components: {
    'a-strips': {},
    'a-waves': {},
    'b-form': {},
    'b-head': { js: true, js_loading: 'defer' },
    'b-heading-eye-1': {},
    'b-heading-eye-2': { js: true, js_loading: 'defer' },
    'b-heading-shapes-1': { js: true, js_loading: 'defer' },
    'b-hero-b2b': { js: true },
    'b-hero-bootcamp': { js: true },
    'b-hero-genai': { js: true },
    'b-hero-home': { js: true },
    'b-hills': { js: true, js_loading: 'defer' },
    'b-image': {},
    'b-interlude-balloons': { js: true },
    'b-interlude-bubbles': { js: true, js_loading: 'defer' },
    'b-marquee': {},
    'b-separator': { js: true, js_loading: 'defer' },
    'b-slider-content': { js: true, js_loading: 'defer' },
    'b-socials': {},
    'b-testimonials': { js: true, js_loading: 'defer' },
    'b-usp-hired': { js: true, js_loading: 'defer' },
    'btn-plain': { js: true },
    'btn-text': { js: true, js_loading: 'defer' },
    's-bootcamps': { js: true, js_loading: 'defer' },
    's-content-1': {},
    's-content-slider': { js: true, js_loading: 'defer' },
    's-courses': { js: true },
    's-courses-list': { js: true, js_loading: 'defer' },
    's-faq': { js: true, js_loading: 'defer' },
    's-form': {},
    's-hero': { js: true, js_loading: 'critical' },
    's-instructors': { js: true, js_loading: 'defer' },
    's-interlude': {},
    's-reviews': { js: true, js_loading: 'defer' },
    's-success-stories': {},
    's-testimonials-clients': {},
    's-usps': { js: true, js_loading: 'defer' },
    's-video-highlight': { js: true, js_loading: 'defer' },
    's-youtube': { js: true, js_loading: 'defer' },
    'site-foot': {},
    'site-head': { js: true },
    'site-loader': { js: true },
    'site-scrollbar': { js: true },
  },
  layouts: {
    b2b: {},
    bootcamp: {},
    'error-404': { js: true },
    'flexible-page': {},
    'front-page': {},
    page: {},
  },
} as const;

// `SiteLoader.transitionOut` looks this up by absolute URL, so the keys are
// rebuilt against `location.origin` in the browser.
export const themeTransitions = {
  '/': { layout: 'front-page' },
  '/alur-penilaian/': { layout: 'bootcamp' },
  '/kebijakan-data/': { layout: 'page' },
  '/kebijakan-privasi/': { layout: 'page' },
  '/panduan-admin/': { layout: 'b2b' },
  '/panduan-penilai/': { layout: 'bootcamp' },
  '/panduan-pimpinan/': { layout: 'b2b' },
} as const;

// Load order matters: the three vendor chunks register themselves on
// `webpackChunknod`, and `main.js` carries the webpack runtime plus the entry.
export const themeScripts = [
  '/assets/js/npm-gsap.js',
  '/assets/js/npm-luge.js',
  '/assets/js/npm-lottie-web.js',
  '/assets/js/main.js',
] as const;
