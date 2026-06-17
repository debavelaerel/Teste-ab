import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Needed for better-auth
  serverExternalPackages: ['better-auth'],
}

export default nextConfig
