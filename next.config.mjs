/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/jobs": ["./data/jobs-snapshot.json"],
      "/api/cron/fetch-jobs": ["./data/jobs-snapshot.json"],
    },
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
};

export default nextConfig;
