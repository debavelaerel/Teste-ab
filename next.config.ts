import { withSentryConfig } from '@sentry/nextjs'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-auth'],
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  // hideSourceMaps does not exist in @sentry/nextjs v10. The v10 equivalent is
  // sourcemaps.deleteSourcemapsAfterUpload, which defaults to `true` — meaning
  // source maps are automatically deleted after upload (same behaviour as the
  // old hideSourceMaps: true).
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  // disableLogger still exists in v10 (SentryBuildOptions) but is deprecated;
  // the replacement is webpack.treeshake.removeDebugLogging. We keep both so
  // the option is honoured regardless of build path (webpack vs turbopack).
  disableLogger: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
})
