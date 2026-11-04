import type { Locator } from '@playwright/test'
import { expect, gotoApp, reloadApp, test, watchConsoleErrors, type Page } from '../support/fixtures.js'

/**
 * Each kind of option field, edited through the ui, is accepted by the backend and kept. Uses the debug entity with an
 * option of every kind, which is only offered when running from source.
 */

const ENTITY_LABEL = '(Debug) All Option Fields'

function entityRow(page: Page): Locator {
	return page.locator('.entity-row', { hasText: ENTITY_LABEL })
}

async function pickOption(page: Page, row: Locator, field: string, option: string | RegExp): Promise<void> {
	await row.getByRole('combobox', { name: field, exact: true }).click()
	await page.getByRole('option', { name: option }).click()
}

async function editFields(page: Page, row: Locator): Promise<void> {
	await row.getByRole('textbox', { name: 'Text input', exact: true }).fill('some text')
	await row.getByRole('textbox', { name: 'Number', exact: true }).fill('42')
	await row.getByRole('textbox', { name: 'Number', exact: true }).blur()
	await row.getByRole('textbox', { name: 'Number range', exact: true }).fill('7')
	await row.getByRole('textbox', { name: 'Number range', exact: true }).blur()
	await row.getByRole('checkbox', { name: 'Checkbox', exact: true }).click()
	await row.getByRole('switch', { name: 'Toggle', exact: true }).click()
	await pickOption(page, row, 'Dropdown', 'Two')
	// Focusing it fills in the current id to edit, so select that before typing over it
	const custom = row.getByRole('combobox', { name: 'Dropdown custom', exact: true })
	await custom.click()
	await expect(custom).toHaveValue('one')
	await custom.press('ControlOrMeta+a')
	await custom.pressSequentially('my own')
	await custom.press('Tab')
	await row.getByRole('textbox', { name: 'Variable value', exact: true }).fill('a value')
	await pickOption(page, row, 'Page', /^1/)
	await row.getByRole('button', { name: 'Left', exact: true }).click()
	await row.getByRole('button', { name: 'Bottom', exact: true }).click()
	await row.getByRole('button', { name: 'Italic', exact: true }).click()

	const multi = row.getByRole('group').filter({ has: page.getByRole('button', { name: 'Remove One' }) })
	await multi.getByRole('combobox').click()
	await page.getByRole('option', { name: 'Two', exact: true }).click()
	await page.keyboard.press('Escape')

	await row.getByRole('button', { name: 'Add row' }).click()
	await row.getByRole('button', { name: 'Add item' }).click()
}

async function checkFields(row: Locator): Promise<void> {
	await expect(row.getByRole('textbox', { name: 'Text input', exact: true })).toHaveValue('some text')
	await expect(row.getByRole('textbox', { name: 'Number', exact: true })).toHaveValue('42')
	await expect(row.getByRole('textbox', { name: 'Number range', exact: true })).toHaveValue('7')
	await expect(row.getByRole('checkbox', { name: 'Checkbox', exact: true })).toBeChecked()
	await expect(row.getByRole('switch', { name: 'Toggle', exact: true })).toBeChecked()
	await expect(row.getByRole('combobox', { name: 'Dropdown', exact: true })).toHaveValue('Two')
	await expect(row.getByRole('combobox', { name: 'Dropdown custom', exact: true })).toHaveValue('my own')
	await expect(row.getByRole('textbox', { name: 'Variable value', exact: true })).toHaveValue('a value')
	await expect(row.getByRole('combobox', { name: 'Page', exact: true })).toHaveValue(/^1/)
	await expect(row.getByRole('button', { name: 'Left', exact: true })).toHaveAttribute('aria-pressed', 'true')
	await expect(row.getByRole('button', { name: 'Bottom', exact: true })).toHaveAttribute('aria-pressed', 'true')
	await expect(row.getByRole('button', { name: 'Italic', exact: true })).toHaveAttribute('aria-pressed', 'true')
	await expect(row.getByRole('button', { name: 'Remove Two' })).toBeVisible()
	await expect(row.getByRole('button', { name: 'Remove One' })).toBeVisible()
	await expect(row.getByRole('button', { name: 'Remove row' })).toHaveCount(1)
	await expect(row.getByRole('textbox', { name: 'Name', exact: true })).toHaveCount(1)
}

test('action option fields persist', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/buttons')
	await page.getByTitle('1/2/6').click()
	await page.getByRole('button', { name: 'Regular button' }).click()

	const addAction = page.getByPlaceholder('+ Add action').first()
	await addAction.click()
	await addAction.fill('all option fields')
	await page.getByRole('option', { name: `internal: ${ENTITY_LABEL}` }).click()

	await editFields(page, entityRow(page))
	await checkFields(entityRow(page))

	await reloadApp(page)
	await page.getByTitle('1/2/6').click()
	await checkFields(entityRow(page))

	expect(errors).toEqual([])
})

test('feedback option fields persist', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/buttons')
	await page.getByTitle('1/2/7').click()
	await page.getByRole('button', { name: 'Regular button' }).click()
	await page.getByRole('tab', { name: 'Feedbacks' }).click()

	const addFeedback = page.getByPlaceholder('+ Add feedback')
	await addFeedback.click()
	await addFeedback.fill('all option fields')
	await page.getByRole('option', { name: `internal: ${ENTITY_LABEL}` }).click()

	await editFields(page, entityRow(page))
	await checkFields(entityRow(page))

	await reloadApp(page)
	await page.getByTitle('1/2/7').click()
	await page.getByRole('tab', { name: 'Feedbacks' }).click()
	await checkFields(entityRow(page))

	expect(errors).toEqual([])
})
