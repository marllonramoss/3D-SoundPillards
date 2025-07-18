import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Desativa ESLint durante o build
  },
  typescript: {
    ignoreBuildErrors: true, // Desativa erros de TypeScript durante o build
  },
};

export default nextConfig;
