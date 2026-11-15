import path from 'node:path'
import type { Page } from '@playwright/test'
import { expect, gotoApp, test } from '../support/fixtures.js'
import { clickWithCursor, shoot, shootPanel, unionClip, withViewport } from './shoot.js'

// docs/user-guide/3_config/the-user-interface.md and the pages of 3_config/system
test.use({ scenario: 'companion/test/docs-scenarios/Studio.ts' })

test('admin interface', async ({ page }) => {
	await withViewport(page, { width: 1440, height: 800 }, async () => {
		await gotoApp(page, '/buttons')
		await expect(page.getByTitle('1/1/3', { exact: true })).toBeVisible()
		await shoot(page, page.locator('body'), '3_config/images/admingui')
	})
})

test('sidebar menu', async ({ page }) => {
	await withViewport(page, { width: 1440, height: 800 }, async () => {
		await gotoApp(page, '/buttons')
		// On a heading, as the items have menus of their own
		const nav = page.locator('.sidebar-nav')
		await clickWithCursor(nav.locator('.nav-title', { hasText: 'Connect' }), 'right')
		const menu = page.getByRole('dialog').or(page.getByRole('menu')).first()
		await expect(menu.getByText('Folding Sidebar')).toBeVisible()
		// Once it has finished appearing
		await expect(menu).toHaveCSS('opacity', '1')
		await shoot(
			page,
			await unionClip(page, [page.locator('.sidebar-header'), menu], 0),
			'3_config/images/sidebar-context-menu'
		)
	})
})

test('help menu', async ({ page }) => {
	await withViewport(page, { width: 1440, height: 800 }, async () => {
		await gotoApp(page, '/buttons')
		const help = page.locator('.top-bar-help-button')
		await clickWithCursor(help, 'left')
		const menu = page.getByRole('dialog').or(page.getByRole('menu')).first()
		await expect(menu).toBeVisible()
		await shoot(page, await unionClip(page, [help, menu]), '3_config/images/header-help-menu')
	})
})

test('installation name', async ({ page }) => {
	await withViewport(page, { width: 1280, height: 800 }, async () => {
		await gotoApp(page, '/settings/general')
		const row = page.locator('.edit-field-row, tr, .row', { hasText: 'Installation Name' }).last()
		await expect(row).toBeVisible()
		// With the header, which shows the name
		await shoot(page, await unionClip(page, [page.locator('.top-bar'), row], 0), '3_config/system/images/install-name')
	})
})

test('protocols', async ({ page }) => {
	await gotoApp(page, '/settings/protocols/rest')
	await expect(page.getByText('REST API').first()).toBeVisible()
	await shootPanel(page.locator('.secondary-panel'), '3_config/system/images/settings-rest-api', false)

	await gotoApp(page, '/settings/protocols/metrics')
	await expect(page.getByText('DocsExampleScrapeTokenNotReal000').first()).toBeVisible()
	await shootPanel(page.locator('.secondary-panel'), '3_config/system/images/settings-prometheus', false)
})

/** The content of a page laid out as a column of boxes, with some of the page around them */
async function pageContentClip(page: Page) {
	const boxes = page.locator('.page-container .page-scroll > *')
	// With anything above the column, such as the import page's cancel button
	const above = page.locator('.page-container .page-shell > :not(.page-scroll)')
	const top = (await above.count()) > 0 ? [above.first()] : []
	return unionClip(page, [...top, boxes.first(), boxes.last()])
}

test('import and export', async ({ page }) => {
	// Tall enough for all of the import page's boxes
	await page.setViewportSize({ width: 1280, height: 1800 })
	await gotoApp(page, '/import-export')
	await shoot(page, await pageContentClip(page), '3_config/system/images/import-export')

	// Import one of the templates of the docs
	const template = path.join(
		import.meta.dirname,
		'../../docs/user-guide/7_surfaces/assets/contour-shuttle-template.companionconfig'
	)
	await page.locator('input[type=file]').first().setInputFiles(template)
	await expect(page.getByRole('button', { name: 'Import (Preserve Unselected)' })).toBeVisible()
	await shoot(page, await pageContentClip(page), '3_config/system/images/import')
})
