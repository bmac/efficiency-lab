import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import { ShewhartPage } from './page.tsx'

export const shewhart: BuildAction<'GET', typeof routes.shewhart> = {
  handler({ request }) {
    return render(<ShewhartPage />, request)
  },
}
