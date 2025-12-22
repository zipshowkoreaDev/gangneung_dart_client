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
  allowedDevOrigins: ["http://192.168.0.157:3000", "http://localhost:3000"],

  // images: {
  //   remotePatterns: getRemotePatterns(),
  // },

  // Turbopack 설정 (Next.js 16+ 기본값)
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },

  // webpack 설정 (Turbopack 미사용 시)
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });

    if (!isServer) {
      config.watchOptions = {
        ignored: ["**/.next/**", "**/node_modules/**"],
        aggregateTimeout: 300,
        poll: 1000,
      };
    }

    return config;
  },
};

export default nextConfig;
