import { landingPageCopy } from "../../content/landing-page.js";

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element && value) {
    element.textContent = value;
    element.dataset.text = value;
  }
}

function setAllText(selector, values) {
  document.querySelectorAll(selector).forEach((element, index) => {
    if (values[index]) {
      element.textContent = values[index];
    }
  });
}

function setAllLabelText(selector, values) {
  document.querySelectorAll(selector).forEach((element, index) => {
    const value = values[index];
    if (!value) return;
    const textNodes = Array.from(element.childNodes).filter(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
    );
    if (textNodes.length) {
      textNodes[textNodes.length - 1].textContent = `\n            ${value}          `;
    } else {
      element.textContent = value;
    }
  });
}

function setButtonText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    const text = element.querySelector(".btn-plain__text, .btn-text__text");
    if (text) {
      text.firstChild.textContent = value;
    } else {
      element.textContent = value;
    }
  });
}

function applyCookieCopy() {
  const banner = document.querySelector(".icr-cc");
  if (!banner) return;
  const paragraph = banner.querySelector(".icr-cc__banner p");
  if (paragraph) paragraph.textContent = "Kami menggunakan cookie untuk menjaga pengalaman penggunaan situs.";
  setText(".icr-cc__btn--decline", "Tolak");
  setText(".icr-cc__btn--accept", "Setuju");
  setText(".icr-cc__link--customize", "Atur");
}

export function applyLandingCopy() {
  document.title = landingPageCopy.title;

  setText(".s__title__main", landingPageCopy.hero.main);
  setText(".s__title__secondary", landingPageCopy.hero.secondary);

  const heroText = document.querySelector(".s-hero .s__text p");
  if (heroText) {
    heroText.textContent = landingPageCopy.hero.body;
  }

  landingPageCopy.features.forEach((feature, index) => {
    const item = document.querySelectorAll(".s-usps .s__usp")[index];
    if (!item) {
      return;
    }

    const title = item.querySelector(".sb__title");
    const body = item.querySelector(".sb__text");
    if (title) {
      title.textContent = feature.title;
    }
    if (body) {
      body.textContent = feature.body;
    }
  });

  const sections = landingPageCopy.sections;
  setText(".s-video-highlight .b__title", sections.videoTitle);
  setText(".s-video-highlight .s__text p", sections.videoBody);
  setText(".s-reviews .s__title", sections.reviewsTitle);
  setAllText(".s-reviews .s__review__rating__counter", ["FSM", "FSM", "FSM"]);
  setText(".s-success-stories .b__word", sections.storiesTitle);
  setAllText(".s-success-stories .sb__quote__text", sections.stories);
  setText(".s-bootcamps .s__title", sections.flowTitle);
  setText(".s-bootcamps .s__intro", sections.flowIntro);
  setAllLabelText(".s-bootcamps .sb__title", sections.flowItems.map(([number, title]) => `${number}  ${title}`));
  setAllText(".s-bootcamps .sb__topic", sections.flowItems.map(([, , body]) => body));
  setAllText(".s-bootcamps .sb__dates", ["Tahap 1", "Tahap 2", "Tahap 3"]);
  setAllText(".s-bootcamps .sb__city", ["FSM UNDIP", "FSM UNDIP", "FSM UNDIP"]);
  setText(".section-summer-bootcamps .s__title", sections.modulesTitle);
  setText(".section-summer-bootcamps .s__intro", sections.modulesIntro);
  setAllLabelText(".section-summer-bootcamps .sb__title", sections.modules);
  setAllText(".section-summer-bootcamps .sb__dates", sections.modules.map(() => "Modul sistem"));
  setAllText(".section-summer-bootcamps .sb__duration", sections.modules.map(() => "Dapat dikembangkan"));
  setAllText(".section-summer-bootcamps .sb__location", sections.modules.map(() => "FSM UNDIP"));
  setAllText(".section-summer-bootcamps .sb__price", sections.modules.map(() => "Aktif"));
  setText(".section-b2b-courses .s__title", sections.operationsTitle);
  setText(".section-b2b-courses .s__intro", sections.operationsIntro);
  setAllLabelText(".section-b2b-courses .sb__title", sections.operations);
  setAllText(".section-b2b-courses .sb__dates", sections.operations.map(() => "Kebutuhan operasional"));
  setAllText(".section-b2b-courses .sb__duration", sections.operations.map(() => "Terintegrasi"));
  setAllText(".section-b2b-courses .sb__location", sections.operations.map(() => "FSM UNDIP"));
  setAllText(".section-b2b-courses .sb__price", sections.operations.map(() => "Tersedia"));
  setAllLabelText(".s-content-slider .sb__title", sections.slider.map(([title]) => title));
  setAllText(".s-content-slider .sb__text", sections.slider.map(([, body]) => body));
  setText(".s-content-1 .s__title", sections.ctaTitle);
  const ctaText = document.querySelector(".s-content-1 .s__text");
  if (ctaText) ctaText.innerHTML = `<p>${sections.ctaBody}</p>`;
  setText(".s-youtube .b__title", sections.articlesTitle);
  setText(".s-youtube .s__text", sections.articlesIntro);
  setAllText(".s-youtube .sb__caption", sections.articleCaptions);
  setText(".site-foot .s__cta__title", sections.footerTitle);
  setText(".site-foot .s__cta__text p", sections.footerBody);
  setButtonText(".site-foot .btn-text", sections.footerAction);
  setText(".site-foot .s__copyright", sections.copyright);
  applyCookieCopy();
}
