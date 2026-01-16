/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: '/Moneta-',
  assetPrefix: '/Moneta-',
  images: {
    unoptimized: true,
  },
  // Your existing config options here
};

export default nextConfig;