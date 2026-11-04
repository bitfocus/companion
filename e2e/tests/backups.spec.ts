import { expect, gotoApp, reloadApp, test, watchConsoleErrors } from '../support/fixtures.js'

test('a backup rule can be configured, run and its backup deleted', async ({ page }) => {
	const errors = watchConsoleErrors(page)
	await gotoApp(page, '/settings/backups')
	await page.getByRole('button', { name: 'Add Backup Rule' }).click()

	const editor = page.locator('.secondary-panel')
	await expect(editor.getByRole('heading', { name: 'Edit Backup Rule' })).toBeVisible()

	await editor.getByRole('textbox', { name: 'Rule Name' }).fill('E2E Backup')
	await editor.getByRole('textbox', { name: 'Cron Schedule' }).fill('30 2 * * 1')
	await editor.getByRole('textbox', { name: 'Backup Name Pattern' }).fill('e2e-$(internal:date_iso)')
	await editor.getByRole('textbox', { name: 'Retention Count' }).fill('3')
	await editor.getByRole('textbox', { name: 'Retention Count' }).blur()
	await editor.getByRole('combobox', { name: 'Backup Type' }).click()
	await page.getByRole('option', { name: 'YAML (More human readable)' }).click()
	await expect(editor.getByRole('combobox', { name: 'Backup Type' })).toHaveText('YAML (More human readable)')
	await expect(page.getByText(/E2E Backup/).first()).toBeVisible()

	await reloadApp(page)
	await page
		.getByText(/E2E Backup/)
		.first()
		.click()
	await expect(editor.getByRole('textbox', { name: 'Rule Name' })).toHaveValue('E2E Backup')
	await expect(editor.getByRole('textbox', { name: 'Cron Schedule' })).toHaveValue('30 2 * * 1')
	await expect(editor.getByRole('textbox', { name: 'Backup Name Pattern' })).toHaveValue('e2e-$(internal:date_iso)')
	await expect(editor.getByRole('textbox', { name: 'Retention Count' })).toHaveValue('3')
	await expect(editor.getByRole('combobox', { name: 'Backup Type' })).toHaveText('YAML (More human readable)')

	// An invalid schedule is refused with the reason, leaving the one before
	await editor.getByRole('textbox', { name: 'Cron Schedule' }).fill('not a schedule')
	await editor.getByRole('textbox', { name: 'Cron Schedule' }).blur()
	await expect(editor.getByRole('textbox', { name: 'Cron Schedule' })).toHaveValue('30 2 * * 1')
	await expect(editor.getByText("'not a schedule' is not a valid cron expression")).toBeVisible()
	await expect(editor.getByRole('textbox', { name: 'Cron Schedule' })).toHaveAttribute('aria-invalid', 'true')

	// Until a change to it is accepted
	await editor.getByRole('textbox', { name: 'Cron Schedule' }).fill('30 3 * * 1')
	await expect(editor.getByText(/is not a valid cron expression/)).toHaveCount(0)

	await editor.getByRole('button', { name: 'Run Now' }).click()
	const backups = editor.getByRole('row').filter({ has: page.getByRole('button', { name: 'Delete backup' }) })
	await expect(backups).toHaveCount(1)
	await expect(backups).toContainText(/^e2e-/)

	await backups.getByRole('button', { name: 'Delete backup' }).click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /Delete/ })
		.click()
	await expect(backups).toHaveCount(0)

	await page.locator('.primary-panel, main').getByRole('button', { name: 'Delete' }).last().click()
	await page
		.getByRole('dialog')
		.getByRole('button', { name: /Delete/ })
		.click()
	await expect(page.getByText(/E2E Backup/)).toHaveCount(0)

	expect(errors).toEqual([])
})
