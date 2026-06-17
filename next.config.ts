import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-auth'],
  output: 'standalone',
}

export default nextConfig
