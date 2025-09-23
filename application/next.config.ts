import type { NextConfig } from "next";
import { BASE_PATH } from "../base-path.mjs";

const nextConfig: NextConfig = {
  // Aplikasi dilayani gateway UNDIP di https://apps-fsm.undip.ac.id/survey/ dengan awalan diteruskan
  // utuh. basePath memprefix /_next/, berkas public/, <Link>, router, dan redirect(); alamat lain yang
  // ditulis tangan memakai withBase() dari src/lib/base-path.ts.
  basePath: BASE_PATH,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
};

export default nextConfig;
