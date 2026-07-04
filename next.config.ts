import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  // Allow HMR when opening the dev server from another device on the LAN (e.g. phone).
  allowedDevOrigins: ["192.168.68.106"],
};

export default nextConfig;
