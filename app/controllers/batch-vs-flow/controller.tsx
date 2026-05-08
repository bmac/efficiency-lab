import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import { BatchVsFlowPage } from './page.tsx'

export const batchVsFlow: BuildAction<'GET', typeof routes.batchVsFlow> = {
  handler({ request }) {
    return render(<BatchVsFlowPage />, request)
  },
}
