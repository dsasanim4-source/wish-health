import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  ...(isGitHubPages
    ? {
        output: "export" as const,
        basePath: "/wish-health",
        assetPrefix: "/wish-health/",
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
