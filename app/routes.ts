import { get, route } from 'remix/fetch-router/routes'

export const routes = route({
  assets: get('/assets/*path'),
  favicon: '/favicon.svg',
  home: '/',
  redBeads: '/red-beads',
  shewhart: '/shewhart',
  pinFactory: '/pin-factory',
  batchVsFlow: '/batch-vs-flow',
  bessemer: '/bessemer',
  cheapestTon: '/cheapest-ton',
})
