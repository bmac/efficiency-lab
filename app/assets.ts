import { createAssetServer } from 'remix/assets'

export const assets = createAssetServer({
  basePath: '/assets',
  rootDir: process.cwd(),
  fileMap: {
    'app/*path': 'app/*path',
    'node_modules/*path': 'node_modules/*path',
  },
  allow: [
    'app/assets/**',
    'app/stats.ts',
    'app/ui/prompt-button.tsx',
    'app/ui/control-chart.tsx',
    'app/controllers/red-beads/**',
    'app/controllers/shewhart/**',
    'app/controllers/pin-factory/**',
    'node_modules/**',
  ],
  deny: ['app/**/*.server.*'],
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
  },
})
