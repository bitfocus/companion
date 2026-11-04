import { expect, gotoApp, test, watchConsoleErrors } from '../support/fixtures.js'

test('the setup wizard steps through and applies a change', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/')
	await page.getByRole('button', { name: 'Help' }).click()
	await page.getByText('Getting Started Wizard').click()

	const wizard = page.getByRole('dialog', { name: 'Welcome to Companion' })
	await wizard.getByRole('button', { name: 'Surfaces' }).click()

	const headings = [
		'USB Surface Detection Configuration',
		'Button Grid Size',
		'Button Appearance',
		'Remote Control Services',
		'Usage Statistics',
		'Admin GUI Password',
		'Timezone',
	]
	for (const heading of headings) {
		await expect(wizard.getByRole('heading', { name: heading })).toBeVisible()
		if (heading === 'Button Appearance') {
			await wizard.getByRole('checkbox', { name: 'Show status icons on each button' }).uncheck()
		}
		await wizard.getByRole('button', { name: 'Next' }).click()
	}

	await wizard.getByRole('button', { name: 'Apply' }).click()
	await expect(wizard.getByRole('heading', { name: "You're all set!" })).toBeVisible()
	await wizard.getByRole('button', { name: 'Finish' }).click()
	await expect(wizard).toHaveCount(0)

	await gotoApp(page, '/settings/buttons')
	const row = page.getByRole('row').filter({ hasText: 'Show the status icons on each button' })
	await expect(row.getByRole('switch')).not.toBeChecked()
	await row.getByTitle('Reset to default').click()
	await expect(row.getByRole('switch')).toBeChecked()

	expect(errors).toEqual([])
})
