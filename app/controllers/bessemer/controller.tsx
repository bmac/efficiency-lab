import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import { BessemerPage } from './page.tsx'

export const bessemer: BuildAction<'GET', typeof routes.bessemer> = {
  handler({ request }) {
    return render(<BessemerPage />, request)
  },
}
