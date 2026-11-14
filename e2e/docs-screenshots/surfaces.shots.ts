import type { Page } from '@playwright/test'
import { expect, gotoApp, test } from '../support/fixtures.js'
import { contentClip, shoot, unionClip, withViewport } from './shoot.js'

// docs/user-guide/3_config/connect/surfaces.md, 7_surfaces/index.md and 6_interactive-buttons/*.md
test.use({ scenario: 'companion/test/docs-scenarios/Studio.ts' })
// Wide, so that the edit panels don't wrap their content too much
test.use({ viewport: { width: 1920, height: 1600 } })

const primary = (page: Page) => page.locator('.primary-panel')
const secondary = (page: Page) => page.locator('.secondary-panel')

/** Open a tab of the surfaces page */
async function openSurfacesTab(page: Page, name: string): Promise<void> {
	await gotoApp(page, '/surfaces')
	await page.getByText(name, { exact: true }).click()
}

test('surfaces', async ({ page }) => {
	await withViewport(page, { width: 1440, height: 760 }, async () => {
		await gotoApp(page, '/surfaces')
		await primary(page).locator('.surface-row', { hasText: 'emulator:studio' }).click()
		await expect(secondary(page).getByText('Settings for Studio')).toBeVisible()
		await shoot(page, page.locator('.split-panels'), '3_config/connect/images/surfaces')
	})
})

test('restricting the pages of a group', async ({ page }) => {
	await gotoApp(page, '/surfaces')
	await primary(page).locator('.surface-group-row').click()
	const row = (label: string) => secondary(page).locator('.edit-field-row, .row', { hasText: label }).last()
	await expect(row('Allowed pages')).toContainText('Audio')
	await shoot(
		page,
		await unionClip(page, [row('Restrict pages'), row('Allowed pages')]),
		'3_config/connect/images/restrict_pages'
	)
})

test('remote surfaces', async ({ page }) => {
	await withViewport(page, { width: 1440, height: 560 }, async () => {
		await openSurfacesTab(page, 'Remote & Discover')
		await expect(secondary(page).getByText('Backstage panel')).toBeVisible()
		await shoot(page, page.locator('.split-panels'), '3_config/connect/images/surfaces-remote')
	})
})

test('surface integrations', async ({ page }) => {
	await openSurfacesTab(page, 'Integrations')
	await expect(primary(page).getByText('Demo: Control Panel')).toBeVisible()
	await shoot(page, await contentClip(primary(page)), '7_surfaces/images/surface-integrations-panel')

	await page.getByRole('button', { name: 'Add Surface Integration' }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog.getByText('Fader Bank')).toBeVisible()
	await shoot(page, dialog, '7_surfaces/images/surface-integrations-add-panel')
})

test('emulator', async ({ page }) => {
	await withViewport(page, { width: 1440, height: 760 }, async () => {
		await page.goto('/emulator/studio')
		await expect(page.locator('.emulatorgrid .button-control')).toHaveCount(32)
		await shoot(page, page.locator('body'), '6_interactive-buttons/images/emulator')
	})
})

test('web buttons', async ({ page }) => {
	await withViewport(page, { width: 1440, height: 760 }, async () => {
		await page.goto('/tablet')
		await expect(page.locator('.button-zone .button-control').first()).toBeVisible()
		await shoot(page, page.locator('body'), '6_interactive-buttons/images/webbuttons')

		await page.getByRole('button', { name: 'Configure Web Buttons' }).click()
		await shoot(page, page.locator('body'), '6_interactive-buttons/images/webbuttons_settings')
	})
})
