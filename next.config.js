/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 14: keep Prisma as external so it can use Node.js modules at runtime.
  // Rename to serverExternalPackages (top-level) when upgrading to Next.js 15+.
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

export default nextConfig;
