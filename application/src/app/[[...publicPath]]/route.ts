import { readFile } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
export async function GET(_request: Request, context: {params: Promise<{publicPath?: string[]}>}) {
 const {publicPath=[]}=await context.params;
 if(publicPath.some(segment=>!/^[-a-z0-9]+$/.test(segment))) return new Response("Tidak ditemukan",{status:404});
 try {
  const html=await readFile(path.join(process.cwd(),"public-site",...publicPath,"index.html"),"utf8");
  return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=0, must-revalidate"}});
 } catch {return new Response("Halaman tidak ditemukan",{status:404})}
}
