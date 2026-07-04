import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow HMR when opening the dev server from another device on the LAN (e.g. phone).
  allowedDevOrigins: ["192.168.68.106"],
};

export default nextConfig;
