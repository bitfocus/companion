import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Canvas, ImageData, loadImage } from '@napi-rs/canvas'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_DIR = join(__dirname, '../__snapshots__')
const FAILURE_DIR = join(__dirname, '../__failures__')

export interface ImageSnapshotOptions {
	/** Maximum ratio of differing pixels allowed (0–1). Default: 0.001 (0.1%) */
	threshold?: number
	/**
	 * Maximum per-channel difference (0–255, premultiplied) for a pixel to still count as matching. Default: 4.
	 * Skia is built per-platform, so anti-aliased edges rasterise ±1 differently between them; without
	 * some tolerance those pixels count as mismatches and the snapshots only pass on the OS that wrote them.
	 */
	colorTolerance?: number
}

/** Default per-channel tolerance — see ImageSnapshotOptions.colorTolerance */
const DEFAULT_COLOR_TOLERANCE = 4

type SnapshotUpdateState = 'all' | 'new' | 'none'

interface ImageMatcherState {
	snapshotState: { snapshotUpdateState: SnapshotUpdateState }
	currentTestName?: string
}

function sanitizeName(name: string): string {
	return name
		.replace(/[^a-zA-Z0-9_-]/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '')
}

interface PixelData {
	data: Uint8ClampedArray
	width: number
	height: number
}

async function decodePng(buffer: Buffer): Promise<PixelData> {
	const img = await loadImage(buffer)
	const canvas = new Canvas(img.width, img.height)
	const ctx = canvas.getContext('2d')
	ctx.drawImage(img, 0, 0)
	const imageData = ctx.getImageData(0, 0, img.width, img.height)
	return { data: imageData.data, width: img.width, height: img.height }
}

/**
 * Largest single-channel difference at pixel offset `i`, measured with the color channels
 * premultiplied by alpha.
 *
 * Skia composites premultiplied and getImageData un-premultiplies, which divides the color
 * channels by alpha. On a nearly-transparent pixel that turns a 1-unit rasterisation difference
 * into an enormous apparent color difference — rgba(0,191,255,4) and rgba(0,128,255,4) differ by
 * 63 per the raw bytes, but composite identically. Comparing premultiplied keeps the metric
 * proportional to what actually lands on screen.
 */
function maxChannelDiff(expected: PixelData, actual: PixelData, i: number): number {
	const expectedAlpha = expected.data[i + 3] ?? 0
	const actualAlpha = actual.data[i + 3] ?? 0

	let maxDiff = Math.abs(expectedAlpha - actualAlpha)
	for (let channel = 0; channel < 3; channel++) {
		const expectedValue = ((expected.data[i + channel] ?? 0) * expectedAlpha) / 255
		const actualValue = ((actual.data[i + channel] ?? 0) * actualAlpha) / 255
		maxDiff = Math.max(maxDiff, Math.abs(expectedValue - actualValue))
	}
	return maxDiff
}

async function buildDiffPng(expected: PixelData, actual: PixelData): Promise<Buffer> {
	const { width, height } = expected
	const diffPixels = new Uint8ClampedArray(width * height * 4)
	// Amplification factor — the sqrt curve expands small differences while large ones stay bright
	const amplification = 2.0

	for (let i = 0; i < expected.data.length; i += 4) {
		const maxDiff = maxChannelDiff(expected, actual, i)
		const gray = Math.min(255, Math.round(Math.sqrt(maxDiff / 255) * 255 * amplification))
		diffPixels[i] = gray
		diffPixels[i + 1] = gray
		diffPixels[i + 2] = gray
		diffPixels[i + 3] = 255
	}

	const diffCanvas = new Canvas(width, height)
	const diffCtx = diffCanvas.getContext('2d')
	diffCtx.putImageData(new ImageData(diffPixels, width, height), 0, 0)
	return diffCanvas.encode('png')
}

function countDiffPixels(expected: PixelData, actual: PixelData, colorTolerance: number): number {
	let diffCount = 0
	for (let i = 0; i < expected.data.length; i += 4) {
		if (maxChannelDiff(expected, actual, i) > colorTolerance) diffCount++
	}
	return diffCount
}

export async function toMatchImageSnapshot(
	this: ImageMatcherState,
	received: Canvas,
	name?: string,
	options?: ImageSnapshotOptions
): Promise<{ pass: boolean; message: () => string }> {
	const threshold = options?.threshold ?? 0.001
	const colorTolerance = options?.colorTolerance ?? DEFAULT_COLOR_TOLERANCE
	const snapshotName = sanitizeName(name ?? this.currentTestName ?? 'snapshot')
	const snapshotPath = join(SNAPSHOT_DIR, `${snapshotName}.png`)
	const updateState = this.snapshotState.snapshotUpdateState
	const snapshotExists = existsSync(snapshotPath)

	const actualBuffer = received.toBuffer('image/png')

	// Write snapshot: on first run ('new') or when explicitly updating ('all')
	if (updateState === 'all' || (updateState !== 'none' && !snapshotExists)) {
		await mkdir(SNAPSHOT_DIR, { recursive: true })
		await writeFile(snapshotPath, actualBuffer)
		const action = updateState === 'all' ? 'updated' : 'written'
		return { pass: true, message: () => `Snapshot ${action}: ${snapshotPath}` }
	}

	if (!snapshotExists) {
		// --ci mode: fail rather than auto-create
		return {
			pass: false,
			message: () => `Missing snapshot: ${snapshotPath}\nRun vitest without --ci to create it`,
		}
	}

	const storedBuffer = await readFile(snapshotPath)
	const [expected, actual] = await Promise.all([decodePng(storedBuffer), decodePng(actualBuffer)])

	if (expected.width !== actual.width || expected.height !== actual.height) {
		await mkdir(FAILURE_DIR, { recursive: true })
		await Promise.all([
			writeFile(join(FAILURE_DIR, `${snapshotName}.actual.png`), actualBuffer),
			writeFile(join(FAILURE_DIR, `${snapshotName}.expected.png`), storedBuffer),
		])
		return {
			pass: false,
			message: () =>
				`Image size mismatch: expected ${expected.width}×${expected.height}, got ${actual.width}×${actual.height}`,
		}
	}

	const diffCount = countDiffPixels(expected, actual, colorTolerance)
	const totalPixels = expected.width * expected.height
	const ratio = diffCount / totalPixels

	if (ratio > threshold) {
		await mkdir(FAILURE_DIR, { recursive: true })
		const diffBuffer = await buildDiffPng(expected, actual)
		await Promise.all([
			writeFile(join(FAILURE_DIR, `${snapshotName}.actual.png`), actualBuffer),
			writeFile(join(FAILURE_DIR, `${snapshotName}.expected.png`), storedBuffer),
			writeFile(join(FAILURE_DIR, `${snapshotName}.diff.png`), diffBuffer),
		])
		const pct = (ratio * 100).toFixed(3)
		const threshPct = (threshold * 100).toFixed(3)
		return {
			pass: false,
			message: () =>
				`Image snapshot mismatch: ${diffCount}/${totalPixels} pixels differ by more than ${colorTolerance}/255 (${pct}% > threshold ${threshPct}%)\nFailure images written to: ${FAILURE_DIR}`,
		}
	}

	return { pass: true, message: () => 'Image matches snapshot' }
}
