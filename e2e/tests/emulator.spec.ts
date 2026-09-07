import { expect, gotoApp, test, type Page } from '../support/fixtures.js'

async function readBackgroundImage(page: Page, title: string): Promise<string> {
	return await page.getByTitle(title).evaluate((el) => getComputedStyle(el).backgroundImage)
}

test.describe('emulator', () => {
	test.describe.configure({ mode: 'serial' })

	test('add an emulator through the surfaces page', async ({ page }) => {
		await gotoApp(page, '/surfaces')

		await page.getByRole('button', { name: 'Add Emulator' }).click()
		const dialog = page.getByRole('dialog')
		await dialog.getByLabel(/^Name/).fill('E2E Emulator')
		await dialog.getByLabel(/^Id/).fill('e2etest')
		await dialog.getByRole('button', { name: 'Add' }).click()
		await expect(dialog).toHaveCount(0)

		// It appears in the emulator list
		await page.goto('/emulator')
		await expect(page.getByText('E2E Emulator')).toBeVisible()
	})

	test('pressing a button in the emulator shows the pushed render', async ({ page }) => {
		// Give the emulator a button with some content
		await gotoApp(page, '/buttons')
		await page.getByTitle('1/2/2').click()
		await page.getByRole('button', { name: 'Regular button' }).click()
		await page.getByRole('tab', { name: 'Style' }).click()
		await page.getByLabel('Button text string').fill('Press me')

		await page.goto('/emulator/e2etest')

		const cell = page.getByTitle('Button 2/2')
		await expect(cell).toBeVisible()
		await expect(cell).toHaveCSS('background-image', /data:image/)
		const unpressed = await readBackgroundImage(page, 'Button 2/2')

		// Hold the button down: the pushed render arrives over the image subscription
		const box = (await cell.boundingBox())!
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
		await page.mouse.down()
		await expect(async () => {
			expect(await readBackgroundImage(page, 'Button 2/2')).not.toBe(unpressed)
		}).toPass()

		// And releasing restores the normal render
		await page.mouse.up()
		await expect(async () => {
			expect(await readBackgroundImage(page, 'Button 2/2')).toBe(unpressed)
		}).toPass()
	})

	test('the keyboard shortcuts press buttons too', async ({ page }) => {
		await page.goto('/emulator/e2etest')

		const cell = page.getByTitle('Button 2/2')
		await expect(cell).toHaveCSS('background-image', /data:image/)
		const unpressed = await readBackgroundImage(page, 'Button 2/2')

		// Row 2 is mapped to the A.. row of keys, so column 2 is 'D'
		await page.keyboard.down('d')
		await expect(async () => {
			expect(await readBackgroundImage(page, 'Button 2/2')).not.toBe(unpressed)
		}).toPass()

		await page.keyboard.up('d')
		await expect(async () => {
			expect(await readBackgroundImage(page, 'Button 2/2')).toBe(unpressed)
		}).toPass()
	})
})
