import type { NextConfig } from "next";

// const getRemotePatterns = () => {
//   return [
//     {
//       protocol: "https" as const,
//       hostname: "colortolife-cms-dev.zipshowkorea.com",
//       port: "",
//       pathname: "/images/**",
//     },
//     {
//       protocol: "https" as const,
//       hostname: "dashboard-dev-api.zipshowkorea.com",
//       port: "",
//       pathname: "/images/**",
//     },
//   ];
// };

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: true,

  // 개발 환경에서 네트워크 접근 허용
  allowedDevOrigins: [
    "http://localhost:3000",
    "https://develop.gangneung-dart.zipshowkorea.com",
  ],

  // images: {
  //   remotePatterns: getRemotePatterns(),
  // },

  // Turbopack 설정 (빈 객체로 webpack 설정과의 충돌 경고 방지)
  turbopack: {},

  // webpack 설정
  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });

    return config;
  },
};

export default nextConfig;
