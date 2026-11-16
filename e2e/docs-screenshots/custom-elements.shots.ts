import type { Page } from '@playwright/test'
import { expect, gotoApp, test } from '../support/fixtures.js'
import { clickWithCursor, gridClip, shoot, shootPanel, unionClip, withViewport } from './shoot.js'

// docs/user-guide/3_config/program/building-blocks/custom-elements.md
test.use({ scenario: 'companion/test/docs-scenarios/CustomActionsAndFeedbacks.ts' })

const IMAGES = '3_config/program/building-blocks/images/custom-elements'

/** Capture the edit panel of the custom element, at a size which shows its preview and properties side by side */
async function shootEditPanel(page: Page, name: string): Promise<void> {
	await withViewport(page, { width: 1800, height: 1100 }, async () => {
		await shootPanel(page.locator('.secondary-panel'), name, false)
	})
}

async function openTab(page: Page, name: string): Promise<void> {
	await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click()
}

test.describe.configure({ mode: 'serial' })

test('custom elements', async ({ page }) => {
	// The preview is as wide as a channel label is, rather than square like a button
	await page.addInitScript(() => window.localStorage.setItem('layered-button-preview-aspect-ratio', '"3:1"'))
	await gotoApp(page, '/custom-elements')
	await page.getByText('Channel label', { exact: true }).click()

	// The elements, with the text selected to show its expression
	await expect(page.locator('.button-layer-elementlist').getByTitle('Bar', { exact: true })).toBeVisible()
	await page.locator('.button-layer-elementlist').getByTitle('Label text', { exact: true }).click()
	await expect(page.getByText('Element Name')).toBeVisible()
	await shootEditPanel(page, `${IMAGES}/editor-elements`)

	await openTab(page, 'Inputs')
	await shootEditPanel(page, `${IMAGES}/inputs`)

	await openTab(page, 'Uses')
	await expect(page.getByText('1/2/2')).toBeVisible()
	await shootEditPanel(page, `${IMAGES}/uses`)
})

test('using a custom element', async ({ page }) => {
	// Zoomed in, as the example is only a few buttons, and wide enough for them to fit at that size
	await page.addInitScript(() => window.localStorage.setItem('grid-zoom-scale:grid', '200'))
	await withViewport(page, { width: 2200, height: 1000 }, async () => {
		await gotoApp(page, '/buttons')
		await shoot(page, await gridClip(page, '1/2/0', '1/2/2'), `${IMAGES}/buttons`)
	})

	await page.getByTitle('1/2/0', { exact: true }).click()
	await page.getByRole('tab', { name: 'Style' }).click()

	// The use of it on a button, with its inputs among the properties
	const elementList = page.locator('.button-layer-elementlist')
	await elementList.getByText('Channel label', { exact: true }).click()
	await expect(page.getByText('Custom: Channel label')).toBeVisible()
	// Wide enough for the preview and the list of elements to sit beside each other, and tall enough for the inputs
	await withViewport(page, { width: 2200, height: 2000 }, async () => {
		await shoot(page, page.locator('.button-layer-style-editor'), `${IMAGES}/using-element`)
	})

	// Where it is offered, among the other elements
	await clickWithCursor(page.getByTitle('Add element'), 'left')
	const menu = page.locator('.popover2-positioner')
	await menu.getByRole('button', { name: 'Custom', exact: true }).click()
	await expect(menu.getByText('Channel label', { exact: true })).toBeVisible()
	await shoot(page, await unionClip(page, [menu, page.getByTitle('Add element')]), `${IMAGES}/add-element`)
})
