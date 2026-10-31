/**
 * Draws the installer artwork into launcher/assets/ (electron-builder's buildResources), in the launcher's palette:
 * the background of the macOS DMG window, and the sidebar of the Windows NSIS installer's welcome/finish pages.
 * The output is committed, so this only needs re-running when the design changes.
 */
import fs from 'node:fs/promises'
import { createCanvas, loadImage, type Canvas, type SKRSContext2D } from '@napi-rs/canvas'
import { DMG_APP_POSITION, DMG_APPLICATIONS_POSITION, DMG_BACKGROUND } from './dmg_layout.mts'

const BRAND = '#d50215' // --color-brand
const LAUNCHER_HEADER = '#1b1f27' // --color-launcher-header

const outDir = new URL('../launcher/assets/', import.meta.url)

/** The launcher header's surface, with its soft glow from the top */
function drawSurface(ctx: SKRSContext2D, W: number, H: number, glowRadius: number): void {
	ctx.fillStyle = LAUNCHER_HEADER
	ctx.fillRect(0, 0, W, H)
	const glow = ctx.createRadialGradient(W / 2, -40, 0, W / 2, -40, glowRadius)
	glow.addColorStop(0, 'rgba(255,255,255,0.09)')
	glow.addColorStop(1, 'rgba(255,255,255,0)')
	ctx.fillStyle = glow
	ctx.fillRect(0, 0, W, H)
}

function drawDmgBackground(scale: number): Canvas {
	const { width: W, height: H } = DMG_BACKGROUND
	const canvas = createCanvas(W * scale, H * scale)
	const ctx = canvas.getContext('2d')
	ctx.scale(scale, scale)

	drawSurface(ctx, W, H, 420)

	ctx.textAlign = 'center'
	ctx.fillStyle = '#fff'
	ctx.font = '700 38px -apple-system, "SF Pro Display", "Helvetica Neue", sans-serif'
	ctx.fillText('Companion', W / 2, 62)
	ctx.fillStyle = 'rgba(255,255,255,0.55)'
	ctx.font = '500 13px -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif'
	ctx.fillText('Drag to Applications to install', W / 2, 92)

	// Tiles behind where Finder draws each icon and its label. Finder always draws the labels in dark text, so the
	// tiles are a light mid-ground they stay readable on.
	for (const p of [DMG_APP_POSITION, DMG_APPLICATIONS_POSITION]) {
		ctx.beginPath()
		ctx.roundRect(p.x - 68, p.y - 68, 136, 160, 22)
		ctx.fillStyle = 'rgba(255,255,255,0.55)'
		ctx.fill()
		ctx.strokeStyle = 'rgba(255,255,255,0.25)'
		ctx.lineWidth = 1
		ctx.stroke()
	}

	const mid = (DMG_APP_POSITION.x + DMG_APPLICATIONS_POSITION.x) / 2
	const y = DMG_APP_POSITION.y
	ctx.strokeStyle = BRAND
	ctx.lineWidth = 3
	ctx.lineCap = 'round'
	ctx.lineJoin = 'round'
	ctx.setLineDash([2, 9])
	ctx.beginPath()
	ctx.moveTo(mid - 42, y)
	ctx.lineTo(mid + 34, y)
	ctx.stroke()
	ctx.setLineDash([])
	ctx.beginPath()
	ctx.moveTo(mid + 30, y - 9)
	ctx.lineTo(mid + 40, y)
	ctx.lineTo(mid + 30, y + 9)
	ctx.stroke()

	return canvas
}

/** NSIS's MUI sidebar is a fixed 164x314; it shows the image unscaled at 100% and stretches it on high-DPI displays */
async function drawNsisSidebar(): Promise<Canvas> {
	const W = 164
	const H = 314
	const canvas = createCanvas(W, H)
	const ctx = canvas.getContext('2d')

	drawSurface(ctx, W, H, 260)

	const logo = await loadImage(await fs.readFile(new URL('icon.png', outDir)))
	const logoSize = 104
	ctx.drawImage(logo, (W - logoSize) / 2, 72, logoSize, logoSize)

	ctx.textAlign = 'center'
	ctx.fillStyle = '#fff'
	ctx.font = '700 22px "Segoe UI", -apple-system, "Helvetica Neue", sans-serif'
	ctx.fillText('Companion', W / 2, 212)

	return canvas
}

/** NSIS only accepts BMP, which the canvas can't encode, so write an uncompressed 24-bit one */
function encodeBmp24(canvas: Canvas): Buffer {
	const { width, height } = canvas
	const rgba = canvas.getContext('2d').getImageData(0, 0, width, height).data
	const rowSize = Math.ceil((width * 3) / 4) * 4
	const headerSize = 14 + 40
	const buf = Buffer.alloc(headerSize + rowSize * height)

	buf.write('BM', 0, 'ascii')
	buf.writeUInt32LE(buf.length, 2)
	buf.writeUInt32LE(headerSize, 10)
	buf.writeUInt32LE(40, 14)
	buf.writeInt32LE(width, 18)
	buf.writeInt32LE(height, 22)
	buf.writeUInt16LE(1, 26)
	buf.writeUInt16LE(24, 28)
	buf.writeUInt32LE(rowSize * height, 34)

	// Rows are stored bottom-up, each pixel as BGR
	for (let y = 0; y < height; y++) {
		const rowStart = headerSize + (height - 1 - y) * rowSize
		for (let x = 0; x < width; x++) {
			const src = (y * width + x) * 4
			const dst = rowStart + x * 3
			buf[dst] = rgba[src + 2]
			buf[dst + 1] = rgba[src + 1]
			buf[dst + 2] = rgba[src]
		}
	}
	return buf
}

await fs.writeFile(new URL('background.png', outDir), drawDmgBackground(1).toBuffer('image/png'))
await fs.writeFile(new URL('background@2x.png', outDir), drawDmgBackground(2).toBuffer('image/png'))
await fs.writeFile(new URL('compinst.bmp', outDir), encodeBmp24(await drawNsisSidebar()))
