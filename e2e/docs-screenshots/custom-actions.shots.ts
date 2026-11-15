import type { APIRequestContext, Page } from '@playwright/test'
import { expect, gotoApp, test } from '../support/fixtures.js'
import { gridClip, shoot, shootPanel, withViewport } from './shoot.js'

// docs/user-guide/3_config/program/building-blocks/custom-actions.md and custom-feedbacks.md
test.use({ scenario: 'companion/test/docs-scenarios/CustomActionsAndFeedbacks.ts' })

const ACTIONS_IMAGES = '3_config/program/building-blocks/images/custom-actions'
const FEEDBACKS_IMAGES = '3_config/program/building-blocks/images/custom-feedbacks'

/**
 * Capture the edit panel of a custom action or feedback, down to the end of its content. The window is widened for it,
 * as its actions and feedbacks wrap a lot in a panel of the usual width
 */
async function shootEditPanel(page: Page, name: string): Promise<void> {
	await withViewport(page, { width: 2200, height: page.viewportSize()?.height ?? 1800 }, async () => {
		await shootPanel(page.locator('.secondary-panel'), name)
	})
}

/** Use the http api, which the scenario enables */
async function post(request: APIRequestContext, url: string): Promise<void> {
	const response = await request.post(url)
	expect(response.ok(), `POST ${url}`).toBe(true)
}

async function openTab(page: Page, name: string): Promise<void> {
	await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click()
}

test.describe.configure({ mode: 'serial' })

test('custom actions', async ({ page, request }) => {
	await gotoApp(page, '/custom-actions')
	const lastRow = page.getByText('Count up to a target, a step at a time')
	await expect(lastRow).toBeVisible()
	await shootPanel(page.locator('.primary-panel'), `${ACTIONS_IMAGES}/list`)

	await page.getByText('Select camera', { exact: true }).click()
	await expect(page.locator('.entity-row', { hasText: 'Custom Variable: Set value' }).first()).toBeVisible()
	await shootEditPanel(page, `${ACTIONS_IMAGES}/editor-actions`)

	await page.getByText('Ramp value', { exact: true }).click()
	await expect(page.locator('.entity-row', { hasText: 'Logic: While loop' }).first()).toBeVisible()
	await shootEditPanel(page, `${ACTIONS_IMAGES}/ramp-actions`)

	await openTab(page, 'Inputs')
	await shootEditPanel(page, `${ACTIONS_IMAGES}/inputs`)

	await openTab(page, 'Local Variables')
	await shootEditPanel(page, `${ACTIONS_IMAGES}/local-variables`)

	// Some runs in progress: one of Ramp A, and two of Ramp B. They ramp slowly, so they are still running for the
	// screenshots. The page's clock is then held at a time before they started, so they show as running for 0s rather
	// than for however long the screenshots take
	await openTab(page, 'Uses')
	await post(request, '/api/location/1/1/0/press')
	await post(request, '/api/location/1/1/1/press')
	// A press is ignored until the button has been released from the one before
	await expect(page.getByText('Running for', { exact: false })).toHaveCount(2)
	await page.waitForTimeout(500)
	await post(request, '/api/location/1/1/1/press')
	await expect(page.getByText(/^2 runs for/)).toBeVisible()
	await page.clock.setFixedTime(new Date('2000-01-01T00:00:00Z'))
	await expect(page.getByText('2 runs for 0s')).toBeVisible()
	await shootEditPanel(page, `${ACTIONS_IMAGES}/uses`)
	await page.getByTitle('Stop every run of it').click()
	await expect(page.getByText('2 runs for 0s')).toBeHidden()

	// The buttons part way through the examples: camera 3 on program, and the ramps part way up
	await post(request, '/api/location/1/0/2/press')
	await post(request, '/api/custom-variable/fader_a/value?value=65')
	await post(request, '/api/custom-variable/fader_b/value?value=50')
	await gotoApp(page, '/buttons')
	const buttons = await gridClip(page, '1/0/0', '1/1/3')
	await shoot(page, buttons, `${ACTIONS_IMAGES}/buttons`)
	await shoot(page, buttons, `${FEEDBACKS_IMAGES}/buttons`)

	await page.getByTitle('1/1/0', { exact: true }).click()
	await shoot(page, page.locator('.entity-row', { hasText: 'Ramp value' }).first(), `${ACTIONS_IMAGES}/calling-action`)

	await page.getByTitle('1/0/0', { exact: true }).click()
	await page.getByRole('tab', { name: 'Feedbacks' }).click()
	await shoot(
		page,
		page.locator('.entity-row', { hasText: 'Camera is selected' }).first(),
		`${FEEDBACKS_IMAGES}/using-feedback`
	)
})

test('custom feedbacks', async ({ page }) => {
	await gotoApp(page, '/custom-feedbacks')

	await page.getByText('Camera is selected', { exact: true }).click()
	await expect(page.locator('.entity-row', { hasText: 'Variable: Check boolean expression' }).first()).toBeVisible()
	await shootEditPanel(page, `${FEEDBACKS_IMAGES}/editor-feedbacks`)

	await openTab(page, 'Inputs')
	await shootEditPanel(page, `${FEEDBACKS_IMAGES}/inputs`)

	await openTab(page, 'Uses')
	await expect(page.getByText('1/0/3')).toBeVisible()
	await shootEditPanel(page, `${FEEDBACKS_IMAGES}/uses`)
})

test('adding a custom action', async ({ page }) => {
	await gotoApp(page, '/buttons')
	await page.getByTitle('1/1/0', { exact: true }).click()

	// The press actions
	await page.getByTitle('Browse Actions').first().click()
	const modal = page.locator('.add-entities-modal')
	// The custom actions are a group of their own, alongside those of the connections
	const selectCamera = modal.getByText('Select camera', { exact: true })
	if (!(await selectCamera.isVisible())) await modal.getByText('Custom actions', { exact: true }).click()
	await expect(selectCamera).toBeVisible()

	await shoot(page, modal, `${ACTIONS_IMAGES}/add-action`)
})
