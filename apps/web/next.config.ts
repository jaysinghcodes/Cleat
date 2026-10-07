import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@cleat/ai",
    "@cleat/api",
    "@cleat/db",
    "@cleat/domain",
    "@cleat/theme",
  ],
  // Root `pnpm lint` is the lint step. Next's build lint expects eslint-config-next.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
