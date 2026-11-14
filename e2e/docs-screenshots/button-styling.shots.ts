import type { Page } from '@playwright/test'
import { expect, gotoApp, test } from '../support/fixtures.js'
import { contentClip, gridClip, shoot, unionClip, withViewport } from './shoot.js'

// docs/user-guide/3_config/program/buttons/creating/button-styling/*.md
test.use({ scenario: 'companion/test/docs-scenarios/Studio.ts' })
// Wide, so that the edit panels don't wrap their content too much
test.use({ viewport: { width: 1920, height: 1600 } })

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

/** Expand only some sections of the properties of the selected element, collapsing the others */
async function showOnlySections(page: Page, names: string[]): Promise<void> {
	const sections = elementOptions(page).locator('.accordion2-item')
	for (let index = 0; index < (await sections.count()); index++) {
		const section = sections.nth(index)
		const name = (await section.locator('.accordion2-trigger').innerText()).trim()
		const region = section.getByRole('region')
		if ((await region.isVisible()) !== names.includes(name)) {
			await section.locator('.accordion2-trigger').click()
			if (names.includes(name)) await expect(region).toBeVisible()
			else await expect(region).toBeHidden()
		}
	}
	// Back to the top, as clicking scrolls the sections clicked into view
	await elementOptions(page).evaluate((element) => {
		element.scrollTop = 0
		element.scrollIntoView({ block: 'start' })
	})
}

/** The preview of the button grows with the height of the editor, so a shorter window for screenshots of it */
const SHORT_WINDOW = { width: 1920, height: 1100 }

/** A section of the properties of the selected element */
function propertySection(page: Page, name: string) {
	return elementOptions(page).locator('.accordion2-item', {
		has: page.locator('.accordion2-header', { hasText: name }),
	})
}

test('layered button editor', async ({ page }) => {
	await withViewport(page, SHORT_WINDOW, async () => {
		await editStyle(page, '1/3/1', 'Meter')
		await shoot(page, panel(page).locator('.button-layer-top'), `${IMAGES}/layered-button-editor`)
	})

	await editStyle(page, '1/3/1', 'Meter')

	await shoot(page, propertySection(page, 'Value'), `${IMAGES}/expression-preview`)
	await showOnlySections(page, ['Value', 'Appearance'])
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
	await page.setViewportSize(SHORT_WINDOW)
	await editStyle(page, '1/3/1', null)
	await panel(page).getByTitle('Custom aspect ratio').click()
	const popover = page.getByRole('dialog')
	await popover.getByRole('textbox').first().fill('16')
	await popover.getByRole('textbox').nth(1).fill('9')
	// Once the preview has taken the new shape
	await expect
		.poll(async () => {
			const box = await panel(page).locator('.button-layer-canvas').boundingBox()
			return box ? Math.round((box.width / box.height) * 100) / 100 : null
		})
		.toBeGreaterThan(1.5)
	await shoot(
		page,
		await unionClip(page, [panel(page).locator('.button-layer-canvas-section'), popover]),
		`${IMAGES}/custom-aspect-ratio`
	)
})

test('element properties', async ({ page }) => {
	await editStyle(page, '1/3/1', 'Title')
	await showOnlySections(page, ['Drawing'])
	await shoot(page, await contentClip(elementOptions(page)), `${IMAGES}/element-property-sections`)
	await showOnlySections(page, ['Content'])
	await shoot(page, propertySection(page, 'Content'), `${IMAGES}/text-element-properties`)
})

test('image element', async ({ page }) => {
	await editStyle(page, '1/3/3', 'Logo')
	await showOnlySections(page, ['Content'])
	await shoot(page, await contentClip(elementOptions(page)), `${IMAGES}/image-element-properties`)

	await propertySection(page, 'Content').getByRole('button', { name: 'Select image' }).click()
	const modal = page.getByRole('dialog')
	await expect(modal.getByText('bitfocus', { exact: true })).toBeVisible()
	await shoot(page, modal, `${IMAGES}/image-picker`)
})

test('group with a square aspect ratio', async ({ page }) => {
	await page.setViewportSize(SHORT_WINDOW)
	await editStyle(page, '1/3/2', 'Arrow')
	await panel(page).getByTitle('2:1 (Stream Deck Plus & Plus XL)').click()
	await shoot(page, panel(page).locator('.button-layer-top'), `${IMAGES}/group-square-aspect-ratio`)
})

test('reference element', async ({ page }) => {
	await editStyle(page, '1/3/4', 'Camera 1')
	await showOnlySections(page, ['Source'])
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
