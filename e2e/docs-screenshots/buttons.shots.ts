import { expect, gotoApp, test } from '../support/fixtures.js'
import { clickWithCursor, panelsClip, shoot, shootPanel, unionClip, withViewport } from './shoot.js'

// docs/user-guide/3_config/program/buttons/index.md and pages.md
test.use({ scenario: 'companion/test/docs-scenarios/Studio.ts' })
// Wide, so that the edit panels don't wrap their content too much
test.use({ viewport: { width: 1920, height: 1600 } })

const IMAGES = '3_config/program/buttons/images'

test('buttons page', async ({ page }) => {
	// Wide enough for the whole of the grid
	await withViewport(page, { width: 1720, height: 560 }, async () => {
		await gotoApp(page, '/buttons')
		await expect(page.getByTitle('1/1/3', { exact: true })).toBeVisible()
		await shoot(page, await panelsClip(page.locator('.buttons-page')), `${IMAGES}/buttons`)
	})
})

test('page actions menu', async ({ page }) => {
	await gotoApp(page, '/buttons')
	const button = page.getByRole('button', { name: 'Page actions' })
	await clickWithCursor(button, 'left')
	const menu = page.getByRole('dialog').filter({ hasText: 'Edit page' })
	await expect(menu).toBeVisible()
	await shoot(page, await unionClip(page, [button, menu]), `${IMAGES}/page-actions-menu`)
})

test('grid toolbar', async ({ page }) => {
	// Wide, for all of the hint to fit
	await withViewport(page, { width: 2000, height: 900 }, async () => {
		await gotoApp(page, '/buttons')
		const toolbar = page.locator('.button-grid-toolbar')
		await toolbar.getByRole('button', { name: 'Copy', exact: true }).click()
		await expect(toolbar.getByRole('status')).not.toHaveText('Select tool')
		await shoot(page, toolbar, `${IMAGES}/grid-toolbar`)
	})
})

test('grid context menu', async ({ page }) => {
	await gotoApp(page, '/buttons')
	await clickWithCursor(page.getByTitle('1/0/2', { exact: true }), 'right')
	const menu = page.getByRole('dialog').filter({ hasText: 'Abort Actions' })
	await expect(menu).toBeVisible()
	const cells = [page.getByTitle('1/0/0', { exact: true }), page.getByTitle('1/3/5', { exact: true })]
	await shoot(page, await unionClip(page, [...cells, menu]), `${IMAGES}/grid-context-menu`)
})

test('pages', async ({ page }) => {
	await gotoApp(page, '/buttons')
	await page.getByRole('tab', { name: 'Pages' }).click()
	const panel = page.locator('.secondary-panel')
	await expect(panel.locator('.pages-list-row')).toHaveCount(4)
	await shootPanel(panel, `${IMAGES}/pages`, false)
})

test('page variables', async ({ page }) => {
	await gotoApp(page, '/buttons')
	await page.getByRole('tab', { name: 'Page Variables' }).click()
	const panel = page.locator('.secondary-panel')
	await expect(panel.getByRole('textbox', { name: 'Current Value' })).toHaveValue('Jane Smith')
	await shootPanel(panel, `${IMAGES}/page-variables`, false)
})
