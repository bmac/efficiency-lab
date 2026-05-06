import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'

import { router } from '../app/router.ts'
import { routes } from '../app/routes.ts'

const ORIGIN = 'http://localhost'

async function get(href: string): Promise<{ status: number; body: string }> {
  let response = await router.fetch(new Request(ORIGIN + href))
  let body = await response.text()
  return { status: response.status, body }
}

describe('router', () => {
  it('GET / returns the lab index', async () => {
    let { status, body } = await get(routes.home.href())
    assert.equal(status, 200)
    assert.match(body, /Origins of Efficiency Lab/)
    assert.match(body, /Red Bead Experiment/)
    assert.match(body, /Shewhart Sandbox/)
    assert.match(body, /Pin Factory/)
  })

  it('GET /red-beads renders the simulator', async () => {
    let { status, body } = await get(routes.redBeads.href())
    assert.equal(status, 200)
    assert.match(body, /Red Bead Experiment/)
    assert.match(body, /Run round/)
    assert.match(body, /Willing Workers/)
  })

  it('GET /shewhart renders the sandbox', async () => {
    let { status, body } = await get(routes.shewhart.href())
    assert.equal(status, 200)
    assert.match(body, /Shewhart Sandbox/)
    assert.match(body, /Western Electric/)
    assert.match(body, /Mean shift/)
  })

  it('GET /pin-factory renders the factory floor', async () => {
    let { status, body } = await get(routes.pinFactory.href())
    assert.equal(status, 200)
    assert.match(body, /Pin Factory/)
    assert.match(body, /Cut/)
    assert.match(body, /Straighten/)
    assert.match(body, /Sharpen/)
    assert.match(body, /Head/)
    assert.match(body, /Paint/)
    assert.match(body, /Pause/)
  })

  it('GET /unknown returns 404', async () => {
    let response = await router.fetch(new Request(ORIGIN + '/does-not-exist'))
    assert.equal(response.status, 404)
  })

  it('asset URL serves the entry script', async () => {
    let response = await router.fetch(
      new Request(ORIGIN + '/assets/app/assets/entry.ts'),
    )
    assert.equal(response.status, 200)
    let body = await response.text()
    assert.match(body, /run\(/)
  })
})
