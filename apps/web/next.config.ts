import type { NextConfig } from "next";

// Prod env hard gate. Fails the build if production flags drift from policy.
// See docs/phases/v1.2.2-production-readiness/design.md (section C2).
if (process.env.NEXT_PUBLIC_DEFIPILOT_ENV === "prod") {
  const violations: string[] = [];
  if (process.env.DEFIPILOT_ENV !== "prod") {
    violations.push(
      'DEFIPILOT_ENV must be "prod" when NEXT_PUBLIC_DEFIPILOT_ENV=prod',
    );
  }
  if (process.env.DEFIPILOT_DEMO_BANNER !== "false") {
    violations.push('DEFIPILOT_DEMO_BANNER must be "false" in prod');
  }
  if (process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID !== "999") {
    violations.push(
      'NEXT_PUBLIC_DEFAULT_CHAIN_ID must be "999" (HyperEVM) in prod',
    );
  }
  if (!process.env.HYPEREVM_RPC_URL) {
    violations.push("HYPEREVM_RPC_URL is required in prod");
  }
  if (violations.length > 0) {
    throw new Error(
      `[defipilot] prod env violations:\n - ${violations.join("\n - ")}`,
    );
  }
}

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: ["@hq/core", "@hq/react"],
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
