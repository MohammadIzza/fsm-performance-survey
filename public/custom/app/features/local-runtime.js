export function markCustomRuntimeReady() {
  document.documentElement.dataset.customFrontend = "ready";
}

function initLottieFallback() {
  if (!window.lottie) {
    return;
  }

  document.querySelectorAll("[data-lg-lottie]").forEach((element) => {
    if (element.dataset.localLottieReady || element.querySelector("svg, canvas")) {
      return;
    }

    const path = element.dataset.lgLottie;
    if (!path) {
      return;
    }

    const animation = window.lottie.loadAnimation({
      container: element,
      renderer: "svg",
      loop: element.hasAttribute("data-lg-lottie-loop"),
      autoplay: element.hasAttribute("data-lg-lottie-autoplay") || element.hasAttribute("data-lg-lottie-required"),
      path
    });

    element.dataset.localLottieReady = "true";
    element.play = () => animation.goToAndPlay(0, true);
    element.stop = () => animation.stop();
  });
}

function revealFallbackContent() {
  const root = document.documentElement;
  const homeHero = document.querySelector(".b-hero-home");
  const shouldFallback = !root.classList.contains("is-loaded") || (homeHero && !homeHero.classList.contains("is-in"));

  if (!shouldFallback) {
    return;
  }

  root.classList.add("app-local-fallback", "is-loaded");

  if (homeHero) {
    homeHero.classList.add("is-in", "is-local-fallback");
    homeHero.querySelectorAll(".js-flower").forEach((flower) => {
      if (typeof flower.play === "function") {
        flower.play();
      }
    });
  }
}

export function initLocalRuntimeFallback() {
  window.setTimeout(() => {
    initLottieFallback();
    revealFallbackContent();
  }, 1800);
}
