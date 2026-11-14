import type { Page } from '@playwright/test'
import { expect, gotoApp, test } from '../support/fixtures.js'
import { clickWithCursor, contentClip, shoot, unionClip, withViewport } from './shoot.js'

// docs/user-guide/3_config/connect/connections.md and modules.md
test.use({ scenario: 'companion/test/docs-scenarios/Studio.ts' })
// Wide, so that the edit panels don't wrap their content too much
test.use({ viewport: { width: 1920, height: 1600 } })

const IMAGES = '3_config/connect/images'

const primary = (page: Page) => page.locator('.primary-panel')
const secondary = (page: Page) => page.locator('.secondary-panel')

/** A row of the list of connections */
const connectionRow = (page: Page, moduleName: string) => primary(page).locator('.list-row', { hasText: moduleName })

test('connections page', async ({ page }) => {
	await withViewport(page, { width: 1440, height: 600 }, async () => {
		await gotoApp(page, '/connections')
		await connectionRow(page, 'Demo: Vision Mixer').click()
		await expect(secondary(page).getByText('Target IP')).toBeVisible()
		await shoot(page, page.locator('.split-panels'), `${IMAGES}/connection_list`)
	})
})

test('adding a connection', async ({ page }) => {
	await gotoApp(page, '/connections')
	await page.getByRole('button', { name: 'Add Connection' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByText('ATEM', { exact: true }).click()
	await expect(dialog.getByText('Connection Label')).toBeVisible()
	await shoot(page, dialog, `${IMAGES}/connections/connection-add-dialog`)
})

test('connection menu', async ({ page }) => {
	await gotoApp(page, '/connections')
	const row = connectionRow(page, 'Demo: Vision Mixer')
	await clickWithCursor(row.getByRole('button').last(), 'left')
	const menu = page.getByRole('dialog')
	await expect(menu.getByText('Known issues')).toBeVisible()
	await shoot(
		page,
		await unionClip(page, [
			primary(page).locator('.list-row').first(),
			primary(page).locator('.list-row').last(),
			menu,
		]),
		`${IMAGES}/connections/connection-popover`
	)
})

test('configuring a connection', async ({ page }) => {
	await gotoApp(page, '/connections')
	await connectionRow(page, 'Demo: Vision Mixer').click()
	await expect(secondary(page).getByText('Target IP')).toBeVisible()
	// Down to the end of its settings, rather than its footer at the bottom of the window
	const sections = secondary(page).locator('.edit-section')
	await shoot(
		page,
		await unionClip(page, [secondary(page).locator('.secondary-panel-simple-header'), sections.last()], 0),
		`${IMAGES}/connections/configure-panel`
	)

	await secondary(page).locator('.edit-field-row', { hasText: 'Module Version' }).getByRole('button').last().click()
	const dialog = page.getByRole('dialog')
	await expect(dialog.getByText('Change Module Version')).toBeVisible()
	await shoot(page, dialog, `${IMAGES}/connections/update-module-version`)
})

test('modules', async ({ page }) => {
	await gotoApp(page, '/modules')
	// Those available from the store too, not only those installed
	await primary(page).getByRole('button', { name: 'Filter by Available' }).click()
	// Refresh the list from the store, so it was last updated a few seconds ago, however long the run has taken
	await primary(page)
		.getByRole('button', { name: /refresh/i })
		.click()
	await expect(primary(page).locator('.last-updated')).toContainText('a few seconds ago')
	await expect(primary(page).getByText('Lighting Desk', { exact: true })).toBeVisible()
	await shoot(page, await contentClip(primary(page)), `${IMAGES}/module-list`)

	// The versions of a real module, an ATEM
	await primary(page).getByText('ATEM', { exact: true }).click()
	await expect(secondary(page).getByText('4.3.0', { exact: true })).toBeVisible()
	await shoot(page, await contentClip(secondary(page)), `${IMAGES}/module-manage`)
})
