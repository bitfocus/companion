import type { Page } from '@playwright/test'
import { expect, gotoApp, test } from '../support/fixtures.js'
import { contentClip, gridClip, shoot, unionClip } from './shoot.js'

// docs/user-guide/3_config/program/buttons/creating/button-styling/*.md
test.use({ scenario: 'companion/test/docs-scenarios/Studio.ts' })

const IMAGES = '3_config/program/buttons/creating/button-styling/images'

const panel = (page: Page) => page.locator('.secondary-panel')
const styleEditor = (page: Page) => panel(page).locator('.button-layer-style-editor')
const elementOptions = (page: Page) => panel(page).locator('.button-layer-options')

/** Open the style of a button in the editor, and select one of its elements */
async function editStyle(page: Page, location: string, element: string | null): Promise<void> {
	await gotoApp(page, '/buttons')
	await page.getByTitle(location, { exact: true }).click()
	await panel(page).getByRole('tab', { name: 'Style', exact: true }).click()
	await expect(styleEditor(page)).toBeVisible()
	if (element) {
		await panel(page).locator('.element-name').getByText(element, { exact: true }).click()
	}
}

/** A section of the properties of the selected element */
function propertySection(page: Page, name: string) {
	return elementOptions(page).locator('.accordion2-item', {
		has: page.locator('.accordion2-header', { hasText: name }),
	})
}

test('layered button editor', async ({ page }) => {
	await editStyle(page, '1/3/1', 'Meter')
	await shoot(page, panel(page).locator('.button-layer-top'), `${IMAGES}/layered-button-editor`)

	await shoot(page, propertySection(page, 'Value'), `${IMAGES}/expression-preview`)
	await shoot(page, await contentClip(elementOptions(page)), `${IMAGES}/gauge-properties`)
})

test('add element menu', async ({ page }) => {
	await editStyle(page, '1/3/1', null)
	const add = panel(page).getByTitle('Add element')
	await add.click()
	const menu = page.getByRole('dialog')
	// The composite elements of a connection are listed under it
	await menu.getByRole('button', { name: 'mixer', exact: true }).click()
	await expect(menu.getByText('Level meter')).toBeVisible()
	await shoot(page, menu, `${IMAGES}/add-element-menu`)
})

test('custom aspect ratio', async ({ page }) => {
	await editStyle(page, '1/3/1', null)
	await panel(page).getByTitle('Custom aspect ratio').click()
	const popover = page.getByRole('dialog')
	await popover.getByRole('textbox').first().fill('16')
	await popover.getByRole('textbox').nth(1).fill('9')
	await shoot(
		page,
		await unionClip(page, [panel(page).locator('.button-layer-canvas-section'), popover]),
		`${IMAGES}/custom-aspect-ratio`
	)
})

test('element properties', async ({ page }) => {
	await editStyle(page, '1/3/1', 'Title')
	await shoot(page, await contentClip(elementOptions(page)), `${IMAGES}/element-property-sections`)
	await shoot(page, propertySection(page, 'Content'), `${IMAGES}/text-element-properties`)
})

test('image element', async ({ page }) => {
	await editStyle(page, '1/3/3', 'Logo')
	await shoot(page, await contentClip(elementOptions(page)), `${IMAGES}/image-element-properties`)

	await propertySection(page, 'Content').getByRole('button', { name: 'Select image' }).click()
	const modal = page.getByRole('dialog')
	await expect(modal.getByText('bitfocus', { exact: true })).toBeVisible()
	await shoot(page, modal, `${IMAGES}/image-picker`)
})

test('group with a square aspect ratio', async ({ page }) => {
	await editStyle(page, '1/3/2', 'Arrow')
	await panel(page).getByTitle('2:1 (Stream Deck Plus & Plus XL)').click()
	await shoot(page, panel(page).locator('.button-layer-top'), `${IMAGES}/group-square-aspect-ratio`)
})

test('reference element', async ({ page }) => {
	await editStyle(page, '1/3/4', 'Camera 1')
	await shoot(page, await contentClip(elementOptions(page)), `${IMAGES}/reference-element`)
})

test('canvas', async ({ page }) => {
	await editStyle(page, '1/3/1', null)
	await panel(page)
		.getByRole('button', { name: /empty-button look/ })
		.click()
	await shoot(page, await contentClip(elementOptions(page)), `${IMAGES}/canvas-layer-options`)
})

test('status indicators', async ({ page }) => {
	await gotoApp(page, '/buttons')
	await page.getByRole('button', { name: 'Next page' }).click()
	await expect(page.getByTitle('2/0/3', { exact: true })).toBeVisible()
	await shoot(page, await gridClip(page, '2/0/1', '2/0/3'), `${IMAGES}/status-indicators`)
})
