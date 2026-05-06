import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import { RedBeadsPage } from './page.tsx'

export const redBeads: BuildAction<'GET', typeof routes.redBeads> = {
  handler({ request }) {
    return render(<RedBeadsPage />, request)
  },
}
