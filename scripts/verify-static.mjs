const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5501";

const routes = [
  "/",
  "/data-bootcamp/",
  "/genai-bootcamp/",
  "/summer-bootcamps/",
  "/professional-training/",
  "/cookie-policy/",
  "/privacy-policy/",
  "/custom/site.css",
  "/custom/site.js",
  "/custom/app/features/landing-copy.js",
  "/custom/content/landing-page.js",
  "/wp-content/themes/nod/static/lottie/home-hero-c.json",
  "/wp-content/themes/nod/build/js/692-34f185bd9f5c7a4bb1ab.js",
  "/wp-content/themes/nod/build/js/7e3-e1ba753f591eb92cf824.js"
];

let failed = false;

for (const route of routes) {
  const url = new URL(route, baseUrl);
  const response = await fetch(url);
  const label = `${response.status} ${route}`;
  console.log(response.ok ? `OK ${label}` : `FAIL ${label}`);
  failed ||= !response.ok;
}

if (failed) {
  process.exitCode = 1;
}
