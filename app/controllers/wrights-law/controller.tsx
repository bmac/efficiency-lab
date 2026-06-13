import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import { WrightsLawPage } from './page.tsx'

export const wrightsLaw: BuildAction<'GET', typeof routes.wrightsLaw> = {
  handler({ request }) {
    return render(<WrightsLawPage />, request)
  },
}
