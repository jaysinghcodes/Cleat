import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@coachloop/ai",
    "@coachloop/api",
    "@coachloop/db",
    "@coachloop/domain",
  ],
  // Root `pnpm lint` is the lint step. Next's build lint expects eslint-config-next.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
