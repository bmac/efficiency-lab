import { createRouter } from 'remix/fetch-router'

import { assets } from './assets.ts'
import { home } from './controllers/home.tsx'
import { pinFactory } from './controllers/pin-factory/controller.tsx'
import { redBeads } from './controllers/red-beads/controller.tsx'
import { shewhart } from './controllers/shewhart/controller.tsx'
import { routes } from './routes.ts'

export const router = createRouter()

router.get(routes.assets, async ({ request }) => {
  let response = await assets.fetch(request)
  return response ?? new Response('Not Found', { status: 404 })
})

router.map(routes.home, home)
router.map(routes.redBeads, redBeads)
router.map(routes.shewhart, shewhart)
router.map(routes.pinFactory, pinFactory)
