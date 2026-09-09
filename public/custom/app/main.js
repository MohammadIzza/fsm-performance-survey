import { onReady } from "./core/dom.js";
import { initExternalLinks } from "./features/external-links.js";
import { applyLandingCopy } from "./features/landing-copy.js";
import { initLocalRuntimeFallback, markCustomRuntimeReady } from "./features/local-runtime.js";

onReady(() => {
  markCustomRuntimeReady();
  applyLandingCopy();
  initExternalLinks();
  initLocalRuntimeFallback();
});
