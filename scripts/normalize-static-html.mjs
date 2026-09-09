import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const publicDir = join(process.cwd(), "public");

async function findHtmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findHtmlFiles(path));
    } else if (entry.name.endsWith(".htm") || entry.name.endsWith(".html")) {
      files.push(path);
    }
  }

  return files;
}

function normalizeHtml(input) {
  let html = input
    .replaceAll("https://nodcoding.com/wp-content/", "/wp-content/")
    .replaceAll("https://www.nodcoding.com/wp-content/", "/wp-content/")
    .replaceAll("https:\\/\\/nodcoding.com\\/wp-content\\/", "\\/wp-content\\/")
    .replaceAll("https:\\/\\/www.nodcoding.com\\/wp-content\\/", "\\/wp-content\\/")
    .replaceAll("../wp-content/", "/wp-content/")
    .replaceAll('src="e-202637.js', 'src="/e-202637.js')
    .replaceAll("src='e-202637.js", "src='/e-202637.js")
    .replaceAll('src="beacon.min.js/', 'src="/beacon.min.js/')
    .replaceAll("src='beacon.min.js/", "src='/beacon.min.js/")
    .replace(/(?<=[("'=,\s])wp-content\//g, "/wp-content/");

  html = html.replaceAll('href="/custom/custom.css"', 'href="/custom/site.css"');
  html = html.replaceAll('src="/custom/custom.js"', 'src="/custom/site.js"');
  html = html.replaceAll('<script defer src="/custom/site.js"></script>', '<script type="module" src="/custom/site.js"></script>');

  if (!html.includes('href="/custom/site.css"')) {
    html = html.replace("</head>", '  <link rel="stylesheet" href="/custom/site.css">\n</head>');
  }

  if (!html.includes('src="/custom/site.js"')) {
    html = html.replace("</body>", '  <script type="module" src="/custom/site.js"></script>\n</body>');
  }

  return html;
}

for (const file of await findHtmlFiles(publicDir)) {
  const original = await readFile(file, "utf8");
  const normalized = normalizeHtml(original);
  if (normalized !== original) {
    await writeFile(file, normalized);
    console.log(`normalized ${file}`);
  }
}
