import { expect, gotoApp, test } from '../support/fixtures.js'

test('create a custom variable through the ui', async ({ page }) => {
	await gotoApp(page, '/variables/custom')

	await page.getByPlaceholder('variableName').fill('my_e2e_var')
	await page.getByRole('button', { name: 'Add' }).click()

	await expect(page.getByText('my_e2e_var')).toBeVisible()
})

test('create a trigger through the ui', async ({ page }) => {
	await gotoApp(page, '/triggers')

	await page.getByRole('button', { name: 'Add Trigger' }).click()

	await expect(page.getByText('New Trigger').first()).toBeVisible()
})
