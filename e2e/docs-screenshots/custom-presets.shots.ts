import type { Page } from '@playwright/test'
import { expect, gotoApp, test } from '../support/fixtures.js'
import { gridClip, shoot, shootPanel, withViewport } from './shoot.js'

// docs/user-guide/3_config/program/building-blocks/custom-presets.md
test.use({ scenario: 'companion/test/docs-scenarios/CustomActionsAndFeedbacks.ts' })
// Wide, so that the edit panels don't wrap their content too much, and short, as the preview of a button grows with the
// height of its editor. It sizes itself when the editor opens, so the window is this size from the start
test.use({ viewport: { width: 1920, height: 1100 } })

const IMAGES = '3_config/program/building-blocks/images/custom-presets'

const panel = (page: Page) => page.locator('.secondary-panel')

/** Capture the edit panel of the custom preset, at a size which shows its preview and properties side by side */
async function shootEditPanel(page: Page, name: string): Promise<void> {
	await withViewport(page, { width: 1800, height: 1100 }, async () => {
		await shootPanel(panel(page), name, false)
	})
}

test.describe.configure({ mode: 'serial' })

test('custom presets', async ({ page }) => {
	await gotoApp(page, '/custom-presets')
	// The collection starts collapsed
	await page.locator('.primary-panel').getByText('Studio', { exact: true }).click()
	await page.getByText('Record', { exact: true }).click()

	// The style of the button, as for any other button
	await panel(page).getByRole('tab', { name: 'Style', exact: true }).click()
	// With the text selected, to show its properties
	await page.locator('.button-layer-elementlist').getByTitle('Text', { exact: true }).first().click()
	await expect(page.getByText('Element Name')).toBeVisible()
	await shoot(page, panel(page), `${IMAGES}/editor-style`)

	await panel(page).getByRole('tab', { name: 'Uses', exact: true }).click()
	await expect(panel(page).getByText('1/3/0')).toBeVisible()
	await shootEditPanel(page, `${IMAGES}/uses`)
})

test('placing a custom preset', async ({ page }) => {
	await gotoApp(page, '/buttons')
	await page.getByRole('tab', { name: 'Presets' }).click()
	await expect(panel(page).getByText('Custom', { exact: true })).toBeVisible()
	await shootPanel(panel(page), `${IMAGES}/presets-list`, false)

	await panel(page).getByText('Custom', { exact: true }).click()
	await panel(page).getByRole('button', { name: 'Studio', exact: true }).click()
	await expect(panel(page).getByRole('button', { name: 'Talkback' })).toBeVisible()
	await shootPanel(panel(page), `${IMAGES}/presets-custom`, false)
})

test('buttons placed from a custom preset', async ({ page }) => {
	// Zoomed in, as the example is only a few buttons, and wide enough for them to fit at that size
	await page.addInitScript(() => window.localStorage.setItem('grid-zoom-scale:grid', '200'))
	await withViewport(page, { width: 2200, height: 1000 }, async () => {
		await gotoApp(page, '/buttons')
		await shoot(page, await gridClip(page, '1/3/0', '1/3/2'), `${IMAGES}/buttons`)
	})
})

test('a linked custom preset', async ({ page }) => {
	await gotoApp(page, '/buttons')
	await page.getByTitle('1/3/0', { exact: true }).click()
	await expect(panel(page).getByText('Custom preset:')).toBeVisible()
	await shootPanel(panel(page), `${IMAGES}/linked-button`, false)
})

test('saving a button as a custom preset', async ({ page }) => {
	await gotoApp(page, '/buttons')
	await page.getByTitle('1/0/0', { exact: true }).click()
	const saveButton = panel(page).getByRole('button', { name: 'Save a copy of this button as a custom preset' })
	await expect(saveButton).toBeVisible()
	await shoot(page, panel(page).locator('.edit-button-summary'), `${IMAGES}/save-as-preset`)
})
