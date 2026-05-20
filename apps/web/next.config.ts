import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: ["@seabw/core"],
  webpack(cfg) {
    cfg.externals = [
      ...(cfg.externals ?? []),
      "pino-pretty",
      "lokijs",
      "encoding",
    ];
    cfg.resolve = cfg.resolve ?? {};
    cfg.resolve.fallback = {
      ...(cfg.resolve.fallback ?? {}),
      "@react-native-async-storage/async-storage": false,
    };
    return cfg;
  },
};

export default config;
