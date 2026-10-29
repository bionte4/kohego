import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async redirects() {
    return [
      { source: "/livestock", destination: "/kandang", permanent: false },
      { source: "/conversion", destination: "/produksi/kimia", permanent: false },
      { source: "/inventory", destination: "/inventori", permanent: false },
      { source: "/marketing/publisher", destination: "/publisher", permanent: false },
      { source: "/settings/roles", destination: "/settings/users", permanent: false },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
