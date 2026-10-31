/**
 * Draws the background of the macOS DMG window into launcher/assets/ (electron-builder's buildResources), in the
 * launcher's palette. The output is committed, so this only needs re-running when the design changes.
 */
import fs from 'node:fs/promises'
import { createCanvas, type Canvas } from '@napi-rs/canvas'
import { DMG_APP_POSITION, DMG_APPLICATIONS_POSITION, DMG_BACKGROUND } from './dmg_layout.mts'

const BRAND = '#d50215' // --color-brand
const LAUNCHER_HEADER = '#1b1f27' // --color-launcher-header

function drawBackground(scale: number): Canvas {
	const { width: W, height: H } = DMG_BACKGROUND
	const canvas = createCanvas(W * scale, H * scale)
	const ctx = canvas.getContext('2d')
	ctx.scale(scale, scale)

	// The launcher header's surface, with its soft glow from the top
	ctx.fillStyle = LAUNCHER_HEADER
	ctx.fillRect(0, 0, W, H)
	const glow = ctx.createRadialGradient(W / 2, -40, 0, W / 2, -40, 420)
	glow.addColorStop(0, 'rgba(255,255,255,0.09)')
	glow.addColorStop(1, 'rgba(255,255,255,0)')
	ctx.fillStyle = glow
	ctx.fillRect(0, 0, W, H)

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

const outDir = new URL('../launcher/assets/', import.meta.url)
await fs.writeFile(new URL('background.png', outDir), drawBackground(1).toBuffer('image/png'))
await fs.writeFile(new URL('background@2x.png', outDir), drawBackground(2).toBuffer('image/png'))
