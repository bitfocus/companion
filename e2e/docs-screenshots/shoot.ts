import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { expect } from '../support/fixtures.js'

const THEMES = ['light', 'dark'] as const

/** Hides what changes from one build to the next, so that an image is only rewritten when the ui changed */
const SCREENSHOT_STYLE = path.join(import.meta.dirname, 'screenshot.css')

/** What to capture: an element, or an area of the page */
export type ShotTarget = Locator | { page: Page; clip: { x: number; y: number; width: number; height: number } }

/**
 * Capture a screenshot for the docs in both themes, from the same state, as `<name>.light.png` and `<name>.dark.png`
 * @param page The page
 * @param target What to capture
 * @param name The path of the image under `docs/user-guide`, without its extension, eg
 * `3_config/images/custom-actions/uses`. The docs show it as `![…](images/custom-actions/uses.png)`
 */
export async function shoot(page: Page, target: ShotTarget, name: string): Promise<void> {
	for (const theme of THEMES) {
		await page.emulateMedia({ colorScheme: theme })
		await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

		const segments = `${name}.${theme}.png`.split('/')
		if ('clip' in target) {
			await expect(target.page).toHaveScreenshot(segments, {
				clip: roundClip(target.clip),
				stylePath: SCREENSHOT_STYLE,
			})
		} else {
			await expect(target).toHaveScreenshot(segments, { stylePath: SCREENSHOT_STYLE })
		}
	}
}

/**
 * The bounding box of an element once it has stopped moving, eg when a menu has finished animating open
 */
async function stableBoundingBox(element: Locator): Promise<Awaited<ReturnType<Locator['boundingBox']>>> {
	// Unchanged for several readings in a row, as an animation can pause between its steps
	let previous = await element.boundingBox()
	let unchanged = 0
	for (let attempt = 0; attempt < 40; attempt++) {
		await element.page().waitForTimeout(100)
		const current = await element.boundingBox()
		unchanged = JSON.stringify(current) === JSON.stringify(previous) ? unchanged + 1 : 0
		if (unchanged >= 3) return current
		previous = current
	}
	throw new Error('The element did not stop moving')
}

/**
 * Round an area out to whole pixels, so that one which moves by a fraction of a pixel (eg as a popover settles) still
 * gives an image of the same size
 */
function roundClip(clip: { x: number; y: number; width: number; height: number }): typeof clip {
	const x = Math.floor(clip.x)
	const y = Math.floor(clip.y)
	return { x, y, width: Math.ceil(clip.x + clip.width) - x, height: Math.ceil(clip.y + clip.height) - y }
}

/**
 * Capture a screenshot for the docs of something which looks the same in both themes, as `<name>.unthemed.png`
 * @param target What to capture
 * @param name The path of the image under `docs/user-guide`, without its extension
 */
export async function shootUnthemed(target: Locator, name: string): Promise<void> {
	await expect(target).toHaveScreenshot(`${name}.unthemed.png`.split('/'), { stylePath: SCREENSHOT_STYLE })
}

/**
 * The area of a panel down to the end of what it shows, rather than the full height of the panel
 * @param panel The panel, which may fill the height of the page
 * @param margin Space to leave below its content
 */
export async function contentClip(panel: Locator, margin = 16): Promise<ShotTarget> {
	const panelBox = await panel.boundingBox()
	if (!panelBox) throw new Error('The panel is not visible')

	// The bottom of the lowest of the elements which show something, ignoring any which only fill the space left
	const contentBottom = await panel.evaluate((element) => {
		const panelRect = element.getBoundingClientRect()
		let bottom = panelRect.top
		for (const child of element.querySelectorAll('*')) {
			if (child.children.length > 0 && !['BUTTON', 'svg', 'SELECT', 'LABEL'].includes(child.tagName)) continue
			const rect = child.getBoundingClientRect()
			if (rect.width === 0 || rect.height === 0 || rect.bottom > panelRect.bottom || rect.top < panelRect.top) continue
			bottom = Math.max(bottom, rect.bottom)
		}
		return bottom
	})

	const bottom = Math.min(panelBox.y + panelBox.height, contentBottom + margin)
	return {
		page: panel.page(),
		clip: { x: panelBox.x, y: panelBox.y, width: panelBox.width, height: bottom - panelBox.y },
	}
}

/**
 * Shrink the window until a panel which fills its height ends just below what it shows, so that the whole panel, with
 * its edges, can be shot without the empty space below its content
 * @param panel The panel
 * @param margin Space to leave below its content
 */
export async function fitWindowToPanel(panel: Locator, margin: number): Promise<void> {
	const page = panel.page()
	const viewport = page.viewportSize()
	const panelBox = await panel.boundingBox()
	const target = await contentClip(panel, margin)
	if (!viewport || !panelBox || !('clip' in target)) throw new Error('The panel is not visible')

	const spare = panelBox.y + panelBox.height - (target.clip.y + target.clip.height)
	await page.setViewportSize({ width: viewport.width, height: Math.ceil(viewport.height - spare) })
}

/** Space left around a panel in its screenshots, so that its rounded corners (and those of panels beside it) show */
const PANEL_PADDING = 8

/**
 * Capture a panel which fills the height of the window, down to the end of its content, with its edges and some of the
 * page around it. The window is shrunk for it, so that the panel ends just below its content, and then put back
 * @param panel The panel
 * @param name The path of the image under `docs/user-guide`, without its extension
 */
export async function shootPanel(panel: Locator, name: string): Promise<void> {
	const page = panel.page()
	const viewport = page.viewportSize()
	if (!viewport) throw new Error('The page has no viewport')

	// The handle to resize the panel beside it would show at its edge, cut off
	const hideHandle = await page.addStyleTag({ content: '.split-panels > .resize-handle { visibility: hidden; }' })
	try {
		await fitWindowToPanel(panel, 16)
		await shoot(page, await panelsClip(panel), name)
	} finally {
		await hideHandle.evaluate((style) => (style as HTMLStyleElement).remove())
		await page.setViewportSize(viewport)
	}
}

/**
 * The area of some panels, with some of the page around them, so that their rounded corners show
 * @param panels The panels, or what contains them (eg `.split-panels`)
 */
export async function panelsClip(panels: Locator): Promise<ShotTarget> {
	const box = await stableBoundingBox(panels)
	if (!box) throw new Error('The panels are not visible')
	return padClip({ page: panels.page(), clip: box }, PANEL_PADDING)
}

/**
 * An area grown by some padding on every side, eg to show some of the page around a panel rather than cutting at
 * its edges
 */
export function padClip(target: ShotTarget, padding: number): ShotTarget {
	if (!('clip' in target)) throw new Error('Only an area can be padded')
	const { x, y, width, height } = target.clip
	return {
		page: target.page,
		clip: { x: x - padding, y: y - padding, width: width + padding * 2, height: height + padding * 2 },
	}
}

/**
 * The area covering some cells of the button grid
 * @param page The page
 * @param from The top left cell, as `page/row/column`
 * @param to The bottom right cell, as `page/row/column`
 */
export async function gridClip(page: Page, from: string, to: string): Promise<ShotTarget> {
	const fromBox = await page.getByTitle(from, { exact: true }).boundingBox()
	const toBox = await page.getByTitle(to, { exact: true }).boundingBox()
	if (!fromBox || !toBox) throw new Error('The grid is not visible')

	const margin = 4
	return {
		page,
		clip: {
			x: fromBox.x - margin,
			y: fromBox.y - margin,
			width: toBox.x + toBox.width - fromBox.x + margin * 2,
			height: toBox.y + toBox.height - fromBox.y + margin * 2,
		},
	}
}

/**
 * Run some steps with the window at another size, eg to take a screenshot of the whole window at a typical size
 * rather than the tall one the screenshots of edit panels need
 */
export async function withViewport(
	page: Page,
	size: { width: number; height: number },
	steps: () => Promise<void>
): Promise<void> {
	const viewport = page.viewportSize()
	if (!viewport) throw new Error('The page has no viewport')

	await page.setViewportSize(size)
	try {
		await steps()
	} finally {
		await page.setViewportSize(viewport)
	}
}

/**
 * The area covering some elements, eg a menu and the button which opened it
 * @param page The page
 * @param elements The elements to cover
 * @param margin Space to leave around them
 */
export async function unionClip(page: Page, elements: Locator[], margin = 8): Promise<ShotTarget> {
	const boxes = await Promise.all(elements.map(async (element) => stableBoundingBox(element)))
	if (boxes.some((box) => !box)) throw new Error('An element is not visible')
	const visible = boxes.filter((box) => !!box)

	const left = Math.max(0, Math.min(...visible.map((box) => box.x)) - margin)
	const top = Math.max(0, Math.min(...visible.map((box) => box.y)) - margin)
	const right = Math.max(...visible.map((box) => box.x + box.width)) + margin
	const bottom = Math.max(...visible.map((box) => box.y + box.height)) + margin
	return { page, clip: { x: left, y: top, width: right - left, height: bottom - top } }
}

/** A mouse pointer, as an arrow with its tip at the top left */
const CURSOR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="28" viewBox="0 0 20 28">
<path d="M1 1 L1 22 L6 17 L9.5 25.5 L13 24 L9.5 15.5 L16.5 15.5 Z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`

/**
 * Click an element, and draw the mouse pointer where it was clicked, as screenshots don't show the real one. Use this to
 * open a menu, so that the screenshot shows what was clicked to open it
 * @param target The element to click, in its centre
 * @param button Which mouse button to click
 */
export async function clickWithCursor(target: Locator, button: 'left' | 'right'): Promise<void> {
	const box = await target.boundingBox()
	if (!box) throw new Error('The element is not visible')
	const x = box.x + box.width / 2
	const y = box.y + box.height / 2

	await target.click({ button })
	await drawCursor(target.page(), x, y)
}

/**
 * Draw the mouse pointer at a point of the page, as screenshots don't show the real one
 * @param page The page
 * @param x Where the tip of the pointer is, from the left of the page
 * @param y Where the tip of the pointer is, from the top of the page
 */
export async function drawCursor(page: Page, x: number, y: number): Promise<void> {
	await page.evaluate(
		({ x, y, svg }) => {
			document.getElementById('docs-screenshot-cursor')?.remove()
			const cursor = document.createElement('div')
			cursor.id = 'docs-screenshot-cursor'
			cursor.style.cssText = `position: fixed; inset: auto; left: ${x}px; top: ${y}px; margin: 0; padding: 0; border: 0; background: none; overflow: visible; pointer-events: none;`
			cursor.innerHTML = svg
			document.body.appendChild(cursor)
			// In the top layer, above any menu which is shown there
			cursor.popover = 'manual'
			cursor.showPopover()
		},
		{ x, y, svg: CURSOR_SVG }
	)
}
