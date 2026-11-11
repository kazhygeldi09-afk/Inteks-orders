import type { NextConfig } from "next";

// Every page here is per-user and read fresh from the database, so the
// Cache Components / Partial Prefetching modes are left off.
const nextConfig: NextConfig = {
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
