import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import { CheapestTonPage } from './page.tsx'

export const cheapestTon: BuildAction<'GET', typeof routes.cheapestTon> = {
  handler({ request }) {
    return render(<CheapestTonPage />, request)
  },
}
