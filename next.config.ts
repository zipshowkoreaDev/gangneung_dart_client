import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: true,

  allowedDevOrigins: [
    "http://localhost:3000",
    "http://172.26.208.1:3000",
    "http://192.168.0.41:3000/",
    "https://develop.gangneung-dart.zipshowkorea.com",
  ],

  turbopack: {},

  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });

    return config;
  },
};

export default nextConfig;
