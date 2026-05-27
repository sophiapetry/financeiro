import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse usa fs/path nativos — não bundlar com webpack
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
