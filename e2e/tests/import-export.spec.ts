import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, gotoApp, test, type Page } from '../support/fixtures.js'

function variableRow(page: Page, name: string) {
	return page.locator('.editor-grid').filter({ hasText: `$(custom:${name})` })
}

// An import reloads the page and touches global state, so keep this file serial
test.describe.configure({ mode: 'serial' })

test('a config export can be imported back through the ui', async ({ page }) => {
	// Create a custom variable worth exporting
	await gotoApp(page, '/variables/custom')
	await page.getByPlaceholder('variableName').fill('exported_var')
	await page.getByRole('button', { name: 'Add' }).click()
	await expect(variableRow(page, 'exported_var')).toBeVisible()

	// Export the config as json through the export wizard
	await gotoApp(page, '/import-export')
	await page.getByRole('button', { name: 'Export configuration' }).click()
	const exportDialog = page.getByRole('dialog')
	await exportDialog.getByRole('combobox').click()
	await page.getByRole('option', { name: 'JSON (Standard)' }).click()
	await exportDialog.getByLabel('File name').fill('e2e-export')
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		exportDialog.getByRole('button', { name: 'Download' }).click(),
	])
	const exportFile = path.join(
		fs.mkdtempSync(path.join(os.tmpdir(), 'companion-e2e-export-')),
		'e2e-export.companionconfig'
	)
	await download.saveAs(exportFile)

	const exported = JSON.parse(fs.readFileSync(exportFile, 'utf8'))
	expect(JSON.stringify(exported.custom_variables ?? exported)).toContain('exported_var')

	// Delete the variable, then restore it by importing the export
	await gotoApp(page, '/variables/custom')
	await variableRow(page, 'exported_var').getByTitle('Delete custom variable').click()
	await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
	await expect(variableRow(page, 'exported_var')).toHaveCount(0)

	await gotoApp(page, '/import-export')
	await page.locator('input[type="file"]').setInputFiles(exportFile)

	// The import wizard: import only the custom variables, preserving everything else
	await expect(page.getByRole('tab', { name: 'Full Import' })).toBeVisible({ timeout: 30_000 })
	for (const label of [
		'Buttons',
		'Triggers',
		'Expression Variables',
		'Surfaces',
		'Known Surfaces',
		'Surface Integrations',
		'Remote Surfaces',
		'Image Library',
	]) {
		const checkbox = page.getByRole('checkbox', { name: label, exact: true })
		if ((await checkbox.count()) > 0) await checkbox.uncheck()
	}
	await page.getByRole('button', { name: 'Import Preserving Unselected' }).click()

	// A successful import reloads the whole page
	await expect(page.locator('.sidebar-nav').first()).toBeVisible({ timeout: 30_000 })

	await gotoApp(page, '/variables/custom')
	await expect(variableRow(page, 'exported_var')).toBeVisible()
})
