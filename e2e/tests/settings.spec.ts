import { expect, gotoApp, reloadApp, test, watchConsoleErrors, type Page } from '../support/fixtures.js'

const SETTING_LABEL = 'Flip counting direction on page up/down buttons'

function settingRow(page: Page) {
	return page.getByRole('row').filter({ hasText: SETTING_LABEL })
}

test('a settings switch persists, and can be reset to default', async ({ page }) => {
	await gotoApp(page, '/settings/buttons')

	const toggle = settingRow(page).getByRole('switch')
	await expect(toggle).toHaveAttribute('aria-checked', 'false')
	await toggle.click()
	await expect(toggle).toHaveAttribute('aria-checked', 'true')

	// The change round-trips through the backend
	await page.reload()
	await expect(page.locator('.sidebar-nav').first()).toBeVisible({ timeout: 30_000 })
	await expect(settingRow(page).getByRole('switch')).toHaveAttribute('aria-checked', 'true')

	// And the reset button restores the default
	await settingRow(page).getByTitle('Reset to default').click()
	await expect(settingRow(page).getByRole('switch')).toHaveAttribute('aria-checked', 'false')
})

// The settings are shared by every test the worker runs, so each test puts back what it changes

test('a text setting persists, and can be reset to default', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/settings/general')
	const row = page.getByRole('row').filter({ hasText: 'Installation Name' })

	await row.getByRole('textbox').fill('E2E Install')
	await row.getByRole('textbox').blur()
	await reloadApp(page)
	await expect(row.getByRole('textbox')).toHaveValue('E2E Install')

	await row.getByTitle('Reset to default').click()
	await expect(row.getByRole('textbox')).toHaveValue('')

	expect(errors).toEqual([])
})

test('number and port settings persist', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	const panel = page.locator('.secondary-panel')

	await gotoApp(page, '/settings/protocols')
	await page.getByText('Artnet', { exact: true }).first().click()
	const universe = panel.getByRole('textbox', { name: 'Universe' })
	const oldUniverse = await universe.inputValue()
	await universe.fill('7')
	await universe.blur()

	await page.getByText('OSC', { exact: true }).first().click()
	const port = panel.getByRole('textbox', { name: 'Listen Port' })
	const oldPort = await port.inputValue()
	await port.fill('45678')
	await port.blur()

	await reloadApp(page)
	await expect(port).toHaveValue('45678')
	await port.fill(oldPort)
	await port.blur()
	await expect(port).toHaveValue(oldPort)

	await page.getByText('Artnet', { exact: true }).first().click()
	await expect(universe).toHaveValue('7')
	await universe.fill(oldUniverse)
	await universe.blur()
	await expect(universe).toHaveValue(oldUniverse)

	expect(errors).toEqual([])
})

async function setGridRows(page: Page, maxRow: string): Promise<void> {
	await gotoApp(page, '/settings/buttons')
	await page.getByRole('button', { name: 'Edit size' }).click()
	const dialog = page.getByRole('dialog', { name: 'Configure Grid Size' })
	await dialog.getByRole('textbox', { name: 'Max Row' }).fill(maxRow)
	await dialog.getByRole('textbox', { name: 'Max Row' }).blur()
	await dialog.getByRole('button', { name: 'Save' }).click()
	await expect(dialog).toHaveCount(0)
}

test('the grid size can be changed', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	const gridRow = page.getByRole('row').filter({ hasText: 'Grid Size' })

	await setGridRows(page, '5')
	await expect(gridRow).toContainText('6 rows x 8 columns')
	await reloadApp(page)
	await expect(gridRow).toContainText('6 rows x 8 columns')

	await setGridRows(page, '3')
	await expect(gridRow).toContainText('4 rows x 8 columns')

	expect(errors).toEqual([])
})

test('a surface bigger than the grid prompts to grow it', async ({ page }) => {
	const errors = watchConsoleErrors(page)

	await gotoApp(page, '/surfaces')
	await page.locator('.primary-panel').getByRole('button', { name: 'Add Emulator' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByLabel(/^Name/).fill('Tall Emulator')
	await dialog.getByLabel(/^Id/).fill('tall')
	await dialog.getByRole('button', { name: 'Add' }).click()
	await expect(dialog).toHaveCount(0)
	await page
		.locator('.primary-panel')
		.getByText(/emulator:tall/)
		.click()
	const rowCount = page.getByRole('textbox', { name: 'Row count' })
	await rowCount.fill('6')
	await rowCount.blur()
	await expect(rowCount).toHaveValue('6')

	await gotoApp(page, '/buttons')
	const prompt = page.getByText('1 surface overflows the grid')
	await expect(prompt).toBeVisible()
	await page.getByRole('button', { name: 'Resize grid to fit' }).click()
	await expect(prompt).toHaveCount(0)

	await gotoApp(page, '/settings/buttons')
	await expect(page.getByRole('row').filter({ hasText: 'Grid Size' })).toContainText('6 rows x 8 columns')

	// Shrunk again, it asks again, until told not to
	await setGridRows(page, '3')
	await gotoApp(page, '/buttons')
	await expect(prompt).toBeVisible()
	await page.getByRole('button', { name: "Don't ask again" }).click()
	await expect(prompt).toHaveCount(0)

	await gotoApp(page, '/settings/buttons')
	const promptRow = page.getByRole('row').filter({ hasText: 'Prompt to expand grid when attaching new surface' })
	await expect(promptRow.getByRole('switch')).not.toBeChecked()
	await promptRow.getByTitle('Reset to default').click()
	await expect(promptRow.getByRole('switch')).toBeChecked()

	await gotoApp(page, '/surfaces/emulator:tall')
	await rowCount.fill('4')
	await rowCount.blur()
	await expect(rowCount).toHaveValue('4')

	expect(errors).toEqual([])
})
