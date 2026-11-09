import type { Locator } from '@playwright/test'
import { expect, gotoApp, reloadApp, test, watchConsoleErrors, type Page } from '../support/fixtures.js'

/** Each kind of control with notes keeps a note added through its editor */

function notesInput(scope: Locator): Locator {
	return scope.getByRole('textbox', { name: 'Internal notes, for whoever maintains this configuration' })
}

/** A saved note is shown collapsed, until clicked to edit */
function savedNote(scope: Locator): Locator {
	return scope.getByRole('button', { name: 'Show all' })
}

async function addNote(scope: Locator, text: string): Promise<void> {
	await scope.getByRole('button', { name: 'Add note' }).click()
	await notesInput(scope).fill(text)
	await notesInput(scope).blur()
}

async function createButton(page: Page, cellTitle: string, typeButtonName: string): Promise<Locator> {
	await gotoApp(page, '/buttons')
	await page.getByTitle(cellTitle).click()
	await page.getByRole('button', { name: typeButtonName }).click()
	return page.locator('.edit-button-panel')
}

test('a regular button keeps its note', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	const editor = await createButton(page, '1/1/6', 'Regular button')
	await addNote(editor, 'regular button note')

	await reloadApp(page)
	await page.getByTitle('1/1/6').click()
	await expect(savedNote(editor)).toHaveText('regular button note')

	expect(errors).toEqual([])
})

test('a button reference keeps its note', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	const editor = await createButton(page, '1/1/7', 'Create a button that mirrors another button.')
	await addNote(editor, 'reference note')

	await reloadApp(page)
	await page.getByTitle('1/1/7').click()
	await expect(savedNote(editor)).toHaveText('reference note')

	expect(errors).toEqual([])
})

test('a trigger keeps its note', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/triggers')
	await page.locator('.primary-panel').getByRole('button', { name: 'Add Trigger' }).click()
	const editor = page.locator('.secondary-panel')
	await page.getByRole('button', { name: 'Edit trigger name' }).click()
	await editor.getByRole('textbox').first().fill('Noted trigger')
	await editor.getByRole('textbox').first().press('Enter')
	await addNote(editor, 'trigger note')

	await reloadApp(page)
	await page.locator('.primary-panel').getByText('Noted trigger').click()
	await expect(savedNote(editor)).toHaveText('trigger note')

	expect(errors).toEqual([])
})

test('an expression variable keeps its note', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/variables/expression')
	await page.locator('.primary-panel').getByRole('button', { name: 'Add Expression Variable' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.getByRole('textbox', { name: 'Name' }).fill('e2e_noted')
	await dialog.getByRole('button', { name: 'Add' }).click()
	await expect(dialog).toHaveCount(0)

	const editor = page.locator('.secondary-panel')
	await addNote(editor, 'expression variable note')

	await reloadApp(page)
	await page
		.locator('.primary-panel')
		.getByRole('button', { name: /\$\(expression:e2e_noted\)/ })
		.click()
	await expect(savedNote(editor)).toHaveText('expression variable note')

	expect(errors).toEqual([])
})
