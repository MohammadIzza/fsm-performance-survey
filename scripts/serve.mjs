import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createServer } from "node:http";

const root = resolve(process.cwd(), "public");
const port = Number(process.env.PORT || 5501);
const host = process.env.HOST || "127.0.0.1";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4"
};

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
  let filePath = normalize(join(root, pathname));

  if (!filePath.startsWith(root)) {
    return null;
  }

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.htm");
  }

  if (!existsSync(filePath) && !extname(filePath)) {
    filePath = join(filePath, "index.htm");
  }

  return filePath;
}

createServer((request, response) => {
  const filePath = resolveRequestPath(request.url || "/");

  if (!filePath || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-store"
  });

  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`Static site running at http://${host}:${port}/`);
  console.log(`Serving ${root}`);
});
