import type { BuildAction } from 'remix/fetch-router'

import type { routes } from '../../routes.ts'
import { render } from '../../utils/render.tsx'
import { PinFactoryPage } from './page.tsx'

export const pinFactory: BuildAction<'GET', typeof routes.pinFactory> = {
  handler({ request }) {
    return render(<PinFactoryPage />, request)
  },
}
