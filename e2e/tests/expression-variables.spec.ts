import type { Locator } from '@playwright/test'
import { expect, gotoApp, reloadApp, test, watchConsoleErrors, type Page } from '../support/fixtures.js'

function listRow(page: Page, name: string): Locator {
	return page.locator('.primary-panel').getByRole('button', { name: new RegExp(`^\\$\\(expression:${name}\\)`) })
}

async function createExpressionVariable(page: Page, name: string): Promise<Locator> {
	await gotoApp(page, '/variables/expression')
	await page.locator('.primary-panel').getByRole('button', { name: 'Add Expression Variable' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByRole('textbox', { name: 'Name' }).fill(name)
	await dialog.getByRole('button', { name: 'Add' }).click()
	await expect(dialog).toHaveCount(0)
	return page.locator('.secondary-panel')
}

test('an expression variable can be renamed and described', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	const editor = await createExpressionVariable(page, 'e2e_before')

	await editor.getByRole('textbox', { name: 'Name' }).fill('e2e_after')
	await editor.getByRole('textbox', { name: 'Description' }).fill('Renamed by e2e')
	await expect(listRow(page, 'e2e_after')).toContainText('Renamed by e2e')
	await expect(listRow(page, 'e2e_before')).toHaveCount(0)

	await reloadApp(page)
	await expect(listRow(page, 'e2e_after')).toContainText('Renamed by e2e')
	await expect(listRow(page, 'e2e_before')).toHaveCount(0)

	expect(errors).toEqual([])
})

test('an invalid name is refused', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	const editor = await createExpressionVariable(page, 'e2e_valid')

	const name = editor.getByRole('textbox', { name: 'Name' })
	await name.fill('not valid!')
	await expect(name).toHaveAttribute('aria-invalid', 'true')
	await expect(listRow(page, 'e2e_valid')).toBeVisible()

	await reloadApp(page)
	await expect(listRow(page, 'e2e_valid')).toBeVisible()
	await expect(name).toHaveValue('e2e_valid')

	expect(errors).toEqual([])
})

test('the value follows its expression', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	const editor = await createExpressionVariable(page, 'e2e_sum')

	await editor.locator('.monaco-editor').click()
	await page.keyboard.press('ControlOrMeta+a')
	await page.keyboard.type('20 + 22')
	await expect(editor.locator('code', { hasText: /^42$/ })).toBeVisible()

	await reloadApp(page)
	await expect(editor.locator('code', { hasText: /^42$/ })).toBeVisible()

	expect(errors).toEqual([])
})
