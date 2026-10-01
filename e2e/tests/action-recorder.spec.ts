import { expect, gotoApp, test } from '../support/fixtures.js'

test('action recorder has its own page and resumes its session after navigation', async ({ page }) => {
	await gotoApp(page, '/buttons/1')
	await expect(page.getByRole('tab', { name: 'Recorder', exact: true })).toHaveCount(0)
	await page.locator('.sidebar-nav').getByRole('link', { name: 'Action Recorder', exact: true }).click()
	await expect(page).toHaveURL(/\/action-recorder$/)
	await expect(page.getByRole('heading', { name: 'Action Recorder', exact: true })).toBeVisible()
	await expect(page.getByRole('heading', { name: 'Recorded actions', exact: true })).toBeVisible()
	await page.getByRole('button', { name: 'Start recording', exact: true }).click()
	await expect(page.getByLabel('Recording in progress', { exact: true })).toBeVisible()
	await gotoApp(page, '/buttons/1')
	await gotoApp(page, '/action-recorder')
	await expect(page.getByLabel('Recording in progress', { exact: true })).toBeVisible()
	await page.getByRole('button', { name: 'Pause recording', exact: true }).click()
	await expect(page.getByLabel('Recording paused', { exact: true })).toBeVisible()
	await page.setViewportSize({ width: 390, height: 844 })
	await expect(page.getByRole('heading', { name: 'Recorded actions', exact: true })).toBeVisible()
	const overflows = await page
		.locator('.action-recorder-split')
		.evaluate((element) => element.scrollWidth > element.clientWidth)
	expect(overflows).toBe(false)
})
