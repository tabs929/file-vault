/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allows the Next.js dev server inside Docker to accept connections
  // from the host browser when using the compose volume mount pattern.
  experimental: {},
};

module.exports = nextConfig;
