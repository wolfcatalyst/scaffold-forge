import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  ...(process.env.DESKTOP_BUILD === "1" ? { output: "export" as const, trailingSlash: true } : {}),
  turbopack: { root: __dirname },
  ...(process.env.DESKTOP_BUILD === "1" ? {} : { async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${backendUrl}/health`,
      },
    ];
  } }),
};

export default nextConfig;
