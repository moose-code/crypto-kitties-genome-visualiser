import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.cryptokitties.co",
      },
    ],
  },
};

export default nextConfig;
