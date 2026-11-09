import { expect, gotoApp, reloadApp, test, watchConsoleErrors, type Page } from '../support/fixtures.js'

/** The grid cell, as other elements can carry its location as their title */
function cell(page: Page, cellTitle: string) {
	return page.locator(`.button-border[title="${cellTitle}"]`)
}

async function createButton(page: Page, cellTitle: string, typeButtonName: string): Promise<void> {
	await cell(page, cellTitle).click()
	await page.getByRole('button', { name: typeButtonName }).click()
}

async function cellImage(page: Page, cellTitle: string): Promise<string> {
	const target = cell(page, cellTitle)
	await expect(target).toHaveCSS('background-image', /data:image/)
	return target.evaluate((el) => getComputedStyle(el).backgroundImage)
}

const editor = (page: Page) => page.locator('.edit-button-panel')

test('page buttons are created and kept', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/buttons')

	const types = [
		{ title: '1/0/2', label: 'Page up' },
		{ title: '1/0/3', label: 'Page number' },
		{ title: '1/0/4', label: 'Page down' },
	]
	for (const { title, label } of types) {
		await createButton(page, title, label)
		await expect(editor(page).getByRole('heading', { name: `${label} button` })).toBeVisible()
		await cellImage(page, title)
	}

	await reloadApp(page)
	for (const { title, label } of types) {
		await cell(page, title).click()
		await expect(editor(page).getByRole('heading', { name: `${label} button` })).toBeVisible()
	}

	expect(errors).toEqual([])
})

test('a page button converts to a regular button which keeps its behaviour', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/buttons')
	await createButton(page, '1/0/6', 'Page down')

	await editor(page).getByRole('button', { name: 'Convert to Normal Button' }).click()
	await page.getByRole('dialog').getByRole('button', { name: 'Convert' }).click()

	await expect(editor(page).getByRole('tab', { name: 'Actions' })).toBeVisible()
	await expect(editor(page).locator('.entity-row')).toContainText(/page/i)

	await reloadApp(page)
	await cell(page, '1/0/6').click()
	await expect(editor(page).locator('.entity-row')).toContainText(/page/i)

	expect(errors).toEqual([])
})

test('a button reference mirrors its source', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/buttons')

	await createButton(page, '1/1/2', 'Regular button')
	await page.getByRole('tab', { name: 'Style' }).click()
	await page.getByLabel('Button text string').fill('Mirror me')
	await cellImage(page, '1/1/2')

	// Each button draws its own location, so the reference never renders identically to its source; check it follows
	// the source's changes instead
	await createButton(page, '1/1/3', 'Create a button that mirrors another button.')
	const unset = await cellImage(page, '1/1/3')
	await editor(page).getByRole('textbox', { name: 'Mirrored location' }).fill('1/1/2')
	await expect.poll(async () => cellImage(page, '1/1/3')).not.toBe(unset)
	const mirrored = await cellImage(page, '1/1/3')

	await cell(page, '1/1/2').click()
	await page.getByRole('tab', { name: 'Style' }).click()
	await page.getByLabel('Button text string').fill('Mirror changed')
	await expect.poll(async () => cellImage(page, '1/1/3')).not.toBe(mirrored)
	const changed = await cellImage(page, '1/1/3')

	await reloadApp(page)
	await expect.poll(async () => cellImage(page, '1/1/3')).toBe(changed)
	await cell(page, '1/1/3').click()
	await expect(editor(page).getByRole('textbox', { name: 'Mirrored location' })).toHaveValue('1/1/2')

	expect(errors).toEqual([])
})
