/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Imagen runtime delgada para el VPS (Epic 9.1 / ADR-002): Next empaqueta solo
  // el servidor y sus dependencias necesarias en .next/standalone, que el
  // Dockerfile arranca con `node server.js`.
  output: "standalone",
};

export default nextConfig;
