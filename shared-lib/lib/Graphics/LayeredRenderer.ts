import type { RendererButtonStyle } from '../Model/Render.js'
import type {
	ButtonGraphicsBoxDrawElement,
	ButtonGraphicsCanvasDrawElement,
	ButtonGraphicsCircleDrawElement,
	ButtonGraphicsGaugeDrawElement,
	ButtonGraphicsGroupDrawElement,
	ButtonGraphicsImageDrawElement,
	ButtonGraphicsLineDrawElement,
	ButtonGraphicsReferenceDrawElement,
	ButtonGraphicsTextDrawElement,
	SomeButtonGraphicsDrawElement,
} from '../Model/StyleLayersModel.js'
import { ButtonGraphicsDecorationType } from '../Model/StyleModel.js'
import { assertNever } from '../Util.js'
import { ButtonDecorationRenderer } from './ButtonDecorationRenderer.js'
import { buildGaugeColorModel, type GaugeColorRun, type GaugeRGBA } from './GaugeColorModel.js'
import type { ImageBase, LineStyle } from './ImageBase.js'
import { DrawBounds, parseColor, rgbRev } from './Util.js'

/**
 * Text outline width as a fraction of the font size. Proportional (rather than a fixed pixel value) so
 * the outline keeps a consistent visual weight relative to its text at any button/canvas size. Because
 * it derives from the render-size font size, it is automatically resolution-independent.
 */
const TEXT_OUTLINE_FACTOR = 1 / 16

export class GraphicsLayeredButtonRenderer {
	static async draw(
		img: ImageBase<any>,
		drawStyle: RendererButtonStyle,
		elementsToHide: ReadonlySet<string>,
		selectedElementId: string | null,
		paddingPx: { x: number; y: number }
	): Promise<void> {
		const backgroundElement = drawStyle.elements[0]?.type === 'canvas' ? drawStyle.elements[0] : undefined

		const drawWidth = img.width - paddingPx.x * 2
		const drawHeight = img.height - paddingPx.y * 2

		// Read the resolved `decoration`, not the raw one off the canvas
		const decoration = drawStyle.decoration
		const showTopBar = decoration === ButtonGraphicsDecorationType.TopBar

		const topBarBounds = new DrawBounds(
			paddingPx.x,
			paddingPx.y,
			drawWidth,
			Math.max(ButtonDecorationRenderer.DEFAULT_HEIGHT, Math.floor(0.2 * drawHeight))
		)
		const topBarHeight = showTopBar ? topBarBounds.height : 0
		const drawBounds = new DrawBounds(paddingPx.x, paddingPx.y + topBarHeight, drawWidth, drawHeight - topBarHeight)

		this.#drawBackgroundElement(img, drawBounds, backgroundElement)

		const selectedElementBounds = await this.#drawElements(
			img,
			drawStyle.elements,
			elementsToHide,
			selectedElementId,
			drawBounds,
			false
		)

		switch (decoration) {
			case ButtonGraphicsDecorationType.None:
				// Do nothing
				break
			case ButtonGraphicsDecorationType.Border:
				ButtonDecorationRenderer.drawBorderWhenPushed(img, drawStyle, drawBounds)
				break
			case ButtonGraphicsDecorationType.TopBar:
				ButtonDecorationRenderer.drawStatusBar(img, drawStyle, topBarBounds, false)
				break
			default:
				assertNever(decoration)
				break
		}

		// Draw top status icons
		if (drawStyle.show_status_icons) {
			ButtonDecorationRenderer.drawIcons(img, drawStyle, topBarBounds)
		}

		// Draw a border around the selected element, do this last so it's on top
		if (selectedElementBounds) this.#drawBoundsLines(img, selectedElementBounds)
	}

	/**
	 * Draw the elements to the image
	 * Returns the selected element bounds, or null if no element was selected or the selected element was not found
	 */
	static async #drawElements(
		img: ImageBase<any>,
		elements: SomeButtonGraphicsDrawElement[],
		elementsToHide: ReadonlySet<string>,
		selectedElementId: string | null,
		drawBounds: DrawBounds,
		skipDrawParent: boolean
	): Promise<DrawBounds | null> {
		let selectedElementBounds: DrawBounds | null = null
		for (const element of elements) {
			// Skip the background element, it's handled separately
			if (element.type === 'canvas') continue

			const skipDraw = skipDrawParent || elementsToHide.has(element.id) || !element.enabled

			let elementBounds: DrawBounds | null = null
			try {
				switch (element.type) {
					case 'group': {
						await img.usingTemporaryLayer(element.opacity, async (img) => {
							await img.usingRotation(drawBounds, element.rotation, async () => {
								elementBounds = await this.#drawGroupElement(img, drawBounds, element, skipDraw)

								// Propagate the selected
								const childElementBounds = await this.#drawElements(
									img,
									element.children,
									elementsToHide,
									selectedElementId,
									elementBounds,
									skipDraw
								)
								if (childElementBounds) selectedElementBounds = childElementBounds
							})
						})
						break
					}
					case 'reference': {
						await img.usingTemporaryLayer(element.opacity, async (img) => {
							await img.usingRotation(drawBounds, element.rotation, async () => {
								elementBounds = await this.#drawReferenceElement(img, drawBounds, element, skipDraw)

								// Note: children of a reference element cannot be individually selected,
								// so the return value (selected child bounds) is intentionally discarded.
								await this.#drawElements(
									img,
									element.children,
									elementsToHide,
									selectedElementId,
									elementBounds,
									skipDraw
								)
							})
						})
						break
					}
					case 'image':
						elementBounds = await this.#drawImageElement(img, drawBounds, element, skipDraw)

						break
					case 'text':
						elementBounds = await this.#drawTextElement(img, drawBounds, element, skipDraw)
						break
					case 'box':
						elementBounds = await this.#drawBoxElement(img, drawBounds, element, skipDraw)
						break
					case 'line':
						elementBounds = await this.#drawLineElement(img, drawBounds, element, skipDraw)
						break
					case 'circle':
						elementBounds = await this.#drawCircleElement(img, drawBounds, element, skipDraw)
						break
					case 'gauge':
						elementBounds = await this.#drawGaugeElement(img, drawBounds, element, skipDraw)
						break
					default:
						assertNever(element)
				}
			} catch (_e) {
				// TODO - log/report error where? Or should this abandon the render and do a placeholder?
			}

			// Find the bounds of the selected element
			if (element.id === selectedElementId) selectedElementBounds = elementBounds
		}

		return selectedElementBounds
	}

	static #drawBackgroundElement(
		_img: ImageBase<any>,
		_drawBounds: DrawBounds,
		backgroundElement: ButtonGraphicsCanvasDrawElement | undefined
	) {
		if (!backgroundElement) return

		// img.box(drawBounds.x, drawBounds.y, drawBounds.maxX, drawBounds.maxY, parseColor(backgroundElement.color))
	}

	static async #drawGroupElement(
		_img: ImageBase<any>,
		parentBounds: DrawBounds,
		element: ButtonGraphicsGroupDrawElement,
		skipDraw: boolean
	): Promise<DrawBounds> {
		const drawBounds = parentBounds.compose(element.x, element.y, element.width, element.height)
		if (skipDraw) return drawBounds

		if (element.squareCoords) {
			const squareSize = Math.min(drawBounds.width, drawBounds.height)
			return new DrawBounds(
				drawBounds.x + (drawBounds.width - squareSize) / 2,
				drawBounds.y + (drawBounds.height - squareSize) / 2,
				squareSize,
				squareSize
			)
		}

		return drawBounds
	}

	static async #drawReferenceElement(
		_img: ImageBase<any>,
		parentBounds: DrawBounds,
		element: ButtonGraphicsReferenceDrawElement,
		_skipDraw: boolean
	): Promise<DrawBounds> {
		return parentBounds.compose(element.x, element.y, element.width, element.height)
	}

	static async #drawImageElement(
		img: ImageBase<any>,
		parentBounds: DrawBounds,
		element: ButtonGraphicsImageDrawElement,
		skipDraw: boolean
	): Promise<DrawBounds> {
		const drawBounds = parentBounds.compose(element.x, element.y, element.width, element.height)
		if (skipDraw || !element.base64Image) return drawBounds

		let imageDrawn: true | false | null = null

		try {
			const imageData = element.base64Image

			await img.usingAlpha(element.opacity, async () => {
				await img.usingRotation(drawBounds, element.rotation, async () => {
					imageDrawn = await img.drawBase64Image(
						imageData,
						drawBounds.x,
						drawBounds.y,
						drawBounds.width,
						drawBounds.height,
						element.halign,
						element.valign,
						element.fillMode
					)
				})
			})
		} catch (e) {
			console.error('error drawing image:', e)
		}

		if (imageDrawn === false) {
			await img.usingTemporaryLayer(element.opacity, async (img) => {
				await img.usingRotation(drawBounds, element.rotation, async () => {
					const { x, y, width, height, maxX, maxY } = drawBounds

					// Orange background
					img.box(x, y, maxX, maxY, '#ff8c00')

					// Square warning triangle icon (same style as the status bar warning icon)
					const iconSize = Math.round(Math.min(width * 0.5, height * 0.33))
					const iconCenterX = x + width / 2
					const iconTop = y + height * 0.1

					img.drawFilledPath(
						[
							[iconCenterX - iconSize / 2, iconTop + iconSize], // bottom-left
							[iconCenterX + iconSize / 2, iconTop + iconSize], // bottom-right
							[iconCenterX, iconTop], // apex
						],
						'#ffffff'
					)

					// Bold "!" inside the triangle, matching the status bar icon
					img.drawTextLineAligned(
						iconCenterX,
						iconTop + iconSize,
						'!',
						'#ff8c00',
						Math.floor(iconSize * 0.7),
						'center',
						'bottom',
						'bold'
					)

					// "image error" label immediately below the icon
					const textY = iconTop + iconSize + Math.round(height * 0.04)
					img.drawAlignedText(
						x,
						textY,
						width,
						maxY - textY,
						'image error',
						'#ffffff',
						maxY - textY,
						true,
						'center',
						'center'
					)
				})
			})
		}

		return drawBounds
	}

	static async #drawTextElement(
		img: ImageBase<any>,
		parentBounds: DrawBounds,
		element: ButtonGraphicsTextDrawElement,
		skipDraw: boolean
	): Promise<DrawBounds> {
		const drawBounds = parentBounds.compose(element.x, element.y, element.width, element.height)
		if (skipDraw || !element.text) return drawBounds

		// Draw button text
		// Scale font to be a percentage relative to the height of the draw area
		const fontSize = (element.fontsize * drawBounds.height) / 100 / 1.2

		// Force some padding around the text, scaled proportionally
		const marginScale = 0.015
		const marginX = 2 * marginScale * drawBounds.width
		const marginY = 1 * marginScale * drawBounds.height

		await img.usingTemporaryLayer(element.opacity, async (img) => {
			await img.usingRotation(drawBounds, element.rotation, async () => {
				img.drawAlignedText(
					drawBounds.x + marginX,
					drawBounds.y + marginY,
					drawBounds.width - 2 * marginX,
					drawBounds.height - 2 * marginY,
					element.text,
					parseColor(element.color),
					fontSize,
					element.fontsizeAllowShrink,
					element.halign,
					element.valign,
					rgbRev(element.outlineColor, true).a > 0
						? {
								width: fontSize * TEXT_OUTLINE_FACTOR,
								color: parseColor(element.outlineColor),
							}
						: undefined,
					element.font
				)
			})
		})

		return drawBounds
	}

	static async #drawBoxElement(
		img: ImageBase<any>,
		parentBounds: DrawBounds,
		element: ButtonGraphicsBoxDrawElement,
		skipDraw: boolean
	): Promise<DrawBounds> {
		const drawBounds = parentBounds.compose(element.x, element.y, element.width, element.height)
		if (skipDraw) return drawBounds

		// Calculate a pixel width, relative to the parent bounds
		const borderWidth = Math.max(0, parentBounds.width, parentBounds.height) * element.borderWidth

		await img.usingTemporaryLayer(element.opacity, async (img) => {
			await img.usingRotation(drawBounds, element.rotation, async () => {
				img.box(
					drawBounds.x,
					drawBounds.y,
					drawBounds.maxX,
					drawBounds.maxY,
					parseColor(element.color),
					{
						color: parseColor(element.borderColor),
						width: borderWidth,
					},
					element.borderPosition
				)
			})
		})

		return drawBounds
	}

	static async #drawLineElement(
		img: ImageBase<any>,
		parentBounds: DrawBounds,
		element: ButtonGraphicsLineDrawElement,
		skipDraw: boolean
	): Promise<DrawBounds> {
		// Convert from fractional coordinates (0-1) to pixel coordinates within parent bounds
		const fromX = parentBounds.x + element.fromX * parentBounds.width
		const fromY = parentBounds.y + element.fromY * parentBounds.height
		const toX = parentBounds.x + element.toX * parentBounds.width
		const toY = parentBounds.y + element.toY * parentBounds.height

		// Calculate bounds for selection (use the bounding box of the line)
		const minX = Math.min(fromX, toX)
		const minY = Math.min(fromY, toY)
		const maxX = Math.max(fromX, toX)
		const maxY = Math.max(fromY, toY)
		const drawBounds = new DrawBounds(minX, minY, maxX - minX, maxY - minY)

		if (skipDraw) return drawBounds

		// Calculate a pixel width, relative to the parent bounds
		const borderWidth = Math.max(1, Math.max(parentBounds.width, parentBounds.height) * element.borderWidth)

		await img.usingAlpha(element.opacity, async () => {
			img.line(fromX, fromY, toX, toY, {
				color: parseColor(element.borderColor),
				width: borderWidth,
			})
		})

		return drawBounds
	}

	static async #drawCircleElement(
		img: ImageBase<any>,
		parentBounds: DrawBounds,
		element: ButtonGraphicsCircleDrawElement,
		skipDraw: boolean
	): Promise<DrawBounds> {
		const drawBounds = parentBounds.compose(element.x, element.y, element.width, element.height)
		if (skipDraw) return drawBounds

		// Calculate a pixel width, relative to the parent bounds
		const borderWidth = Math.max(0, parentBounds.width, parentBounds.height) * element.borderWidth

		await img.usingTemporaryLayer(element.opacity, async (img) => {
			const midX = drawBounds.x + drawBounds.width / 2
			const midY = drawBounds.y + drawBounds.height / 2
			const radiusX = drawBounds.width / 2
			const radiusY = drawBounds.height / 2

			const startAngle = this.#angleToRadians(element.startAngle + 90)
			const endAngle = this.#angleToRadians(element.endAngle + 90)

			img.circle(
				midX,
				midY,
				radiusX,
				radiusY,
				startAngle,
				endAngle,
				element.drawSlice,
				parseColor(element.color),
				{
					color: parseColor(element.borderColor),
					width: borderWidth,
				},
				element.borderOnlyArc,
				element.borderPosition
			)
		})

		return drawBounds
	}

	static async #drawGaugeElement(
		img: ImageBase<any>,
		parentBounds: DrawBounds,
		element: ButtonGraphicsGaugeDrawElement,
		skipDraw: boolean
	): Promise<DrawBounds> {
		const drawBounds = parentBounds.compose(element.x, element.y, element.width, element.height)
		if (skipDraw) return drawBounds

		const { x, y, width, height, maxX, maxY } = drawBounds
		const { orientation, reverse, multiColour, trackStyle, symmetric } = element

		const finite = (v: unknown, fallback: number): number => {
			const n = Number(v)
			return Number.isFinite(n) ? n : fallback
		}

		// Shared value/colour model (0–100 track-position space): the fill interval, colour runs and
		// fill colour. This also drives the LED baker (`bakeGaugeToLeds`), so LEDs match the pixels.
		// The trivial per-element flags/geometry (above + below) stay local to the renderer.
		const model = buildGaugeColorModel(element)
		if (!model) return drawBounds
		const { valuePos, fillStart, fillEnd, hasFill, trackAmount, runs, singleColor, rgbaAt } = model

		const trackWidth = Math.max(0, Math.min(100, finite(element.trackWidth, 100))) / 100

		const cssOf = (c: GaugeRGBA): string => `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${c.a})`
		// Track (unfilled) colour. 'transparent' base colours are emitted at full alpha and composited
		// through a temporary layer at trackAmount; 'dimmed' darkens the colour in place.
		const trackTransform = (c: GaugeRGBA): GaugeRGBA => {
			if (trackStyle === 'transparent') return c
			return { r: c.r * trackAmount, g: c.g * trackAmount, b: c.b * trackAmount, a: c.a }
		}

		// --- Geometry helpers shared by fill, track and marker passes. ---
		const isRing = orientation === 'ring'
		const isHorizontal = orientation === 'horizontal'

		// Cross-axis geometry. The fill (indicator) uses the FULL cross-axis; trackWidth only
		// narrows the unfilled track, so the fill can be drawn wider than the track.
		const crossFull = isHorizontal ? height : width
		const fillHalf = crossFull / 2
		const trackHalf = (crossFull * trackWidth) / 2
		const bandCenter = isHorizontal ? y + height / 2 : x + width / 2

		const posToX = (p: number): number => (reverse ? maxX - (p / 100) * width : x + (p / 100) * width)
		const posToY = (p: number): number => (reverse ? y + (p / 100) * height : maxY - (p / 100) * height)

		// Ring geometry.
		const cx = x + width / 2
		const cy = y + height / 2
		const outerRadius = Math.min(width, height) / 2
		const ringWidthPx = outerRadius * (element.ringWidth / 100)
		const arcRadius = outerRadius - ringWidthPx / 2
		// Ring stroke widths: fill uses the full ring width; the track is narrowed by trackWidth.
		const fillStrokePx = ringWidthPx
		const trackStrokePx = ringWidthPx * trackWidth
		// Arc span: clockwise from startAngle to endAngle (degrees, 0 = top). 0 span → full circle.
		const startAngleDeg = finite(element.startAngle, 0)
		const endAngleDeg = finite(element.endAngle, 360)
		let sweepDeg = (((endAngleDeg - startAngleDeg) % 360) + 360) % 360
		if (sweepDeg === 0) sweepDeg = 360
		const degToRad = (deg: number): number => -Math.PI / 2 + (deg * Math.PI) / 180
		// p=0 at startAngle, p=100 at endAngle (clockwise). reverse flips which end is p=0.
		const posToAngle = (p: number): number => degToRad(startAngleDeg + (reverse ? 1 - p / 100 : p / 100) * sweepDeg)

		// Paint a single position-space interval [a, b] with one solid colour onto `target`.
		// `wide` selects the fill width (full) vs the narrowed track width.
		const paintSolid = (target: ImageBase<any>, a: number, b: number, color: string, wide: boolean): void => {
			if (b - a <= 1e-6) return
			if (isRing) {
				const r1 = posToAngle(a)
				const r2 = posToAngle(b)
				target.arcStroke(cx, cy, arcRadius, Math.min(r1, r2), Math.max(r1, r2), false, {
					color,
					width: wide ? fillStrokePx : trackStrokePx,
				})
			} else {
				const half = wide ? fillHalf : trackHalf
				const lo = bandCenter - half
				const hi = bandCenter + half
				if (isHorizontal) {
					const xa = posToX(a)
					const xb = posToX(b)
					target.box(Math.round(Math.min(xa, xb)), lo, Math.round(Math.max(xa, xb)), hi, color)
				} else {
					const ya = posToY(a)
					const yb = posToY(b)
					target.box(lo, Math.round(Math.min(ya, yb)), hi, Math.round(Math.max(ya, yb)), color)
				}
			}
		}

		// Approximate the pixel length of an interval, to choose a gradient sub-step count.
		const pixelLen = (a: number, b: number): number => {
			if (isRing) return arcRadius * Math.abs(posToAngle(b) - posToAngle(a))
			return isHorizontal ? Math.abs(posToX(b) - posToX(a)) : Math.abs(posToY(b) - posToY(a))
		}

		// Paint an interval [a, b] of a run onto `target`, applying a colour transform.
		const paintRunInterval = (
			target: ImageBase<any>,
			a: number,
			b: number,
			run: GaugeColorRun,
			transform: (c: GaugeRGBA) => GaugeRGBA,
			wide: boolean
		): void => {
			if (b - a <= 1e-6) return
			const steps = run.gradient ? Math.max(1, Math.min(64, Math.ceil(pixelLen(a, b) / 2))) : 1
			for (let s = 0; s < steps; s++) {
				const sa = a + ((b - a) * s) / steps
				const sb = a + ((b - a) * (s + 1)) / steps
				paintSolid(target, sa, sb, cssOf(transform(rgbaAt(run, (sa + sb) / 2))), wide)
			}
		}

		await img.usingTemporaryLayer(element.opacity, async (layer) => {
			await layer.usingRotation(drawBounds, element.rotation, async () => {
				// Whether the ring forms a complete circle (no ends to round).
				const fullCircle = isRing && sweepDeg >= 360 && fillLo <= 1e-6 && fillHi >= 100 - 1e-6
				const partialRing = isRing && sweepDeg < 360

				// --- Track pass: the parts of each run NOT covered by the fill. ---
				const paintTrack = (target: ImageBase<any>) => {
					for (const run of runs) {
						const leftHi = Math.min(run.end, hasFill ? fillLo : run.end)
						if (leftHi > run.start) paintRunInterval(target, run.start, leftHi, run, trackTransform, false)
						if (hasFill) {
							const rightLo = Math.max(run.start, fillHi)
							if (run.end > rightLo) paintRunInterval(target, rightLo, run.end, run, trackTransform, false)
						}
					}

					// On a partial ring the open track ends follow the rounded-ends flag.
					if (partialRing && element.roundedEnds) {
						const r = trackStrokePx / 2
						const lastRun = runs[runs.length - 1]
						const ends: Array<[number, number]> = [
							[0, runs[0].colorStart],
							[100, lastRun.gradient ? lastRun.colorEnd : lastRun.colorStart],
						]
						for (const [p, colorNum] of ends) {
							const ang = posToAngle(p)
							target.circle(
								cx + arcRadius * Math.cos(ang),
								cy + arcRadius * Math.sin(ang),
								r,
								r,
								0,
								Math.PI * 2,
								false,
								cssOf(trackTransform(rgbRev(colorNum, true)))
							)
						}
					}
				}
				if (trackStyle === 'transparent') {
					// Composite the whole track through one layer so the requested transparency is
					// applied once, and anti-aliased seams between runs don't accumulate into bright lines.
					await layer.usingTemporaryLayer(trackAmount, async (trackLayer) => paintTrack(trackLayer))
				} else {
					paintTrack(layer)
				}

				// --- Fill pass: the active portion of each run (full width). ---
				if (hasFill) {
					for (const run of runs) {
						const aLo = Math.max(run.start, fillLo)
						const aHi = Math.min(run.end, fillHi)
						if (aHi <= aLo) continue
						if (multiColour) {
							paintRunInterval(layer, aLo, aHi, run, (c) => c, true)
						} else {
							paintSolid(layer, aLo, aHi, parseColor(singleColor), true)
						}
					}

					// Rounded ends on a ring active fill (skip when the fill is a complete circle).
					if (isRing && element.roundedEnds && !fullCircle) {
						const capRadius = fillStrokePx / 2
						const colorAtPos = (p: number): number => {
							if (!multiColour) return singleColor
							const run = runs.find((r) => p >= r.start && p <= r.end) ?? runs[runs.length - 1]
							if (!run.gradient) return run.colorStart
							const span = run.end - run.start
							// Use whichever stop colour the position is closer to.
							return span > 0 && p - run.start > span / 2 ? run.colorEnd : run.colorStart
						}
						for (const p of [fillLo, fillHi]) {
							const ang = posToAngle(p)
							layer.circle(
								cx + arcRadius * Math.cos(ang),
								cy + arcRadius * Math.sin(ang),
								capRadius,
								capRadius,
								0,
								Math.PI * 2,
								false,
								parseColor(colorAtPos(p))
							)
						}
					}
				}

				// --- Marker pass: a single-colour line at the value, spanning the full fill width. ---
				if (element.markerEnabled) {
					const markerColor = parseColor(element.markerColor)
					const markerW = Math.max(1, Math.min(100, finite(element.markerWidth, 15))) / 100
					const cap: CanvasLineCap = element.roundedEnds ? 'round' : 'butt'
					// The marker follows the value: its leading edge(s). In symmetric mode that's both
					// fill edges; otherwise the single value position.
					const positions = symmetric ? [fillLo, fillHi] : [valuePos]
					for (const rawP of positions) {
						const p = Math.max(0, Math.min(100, rawP))
						if (isRing) {
							// A short arc bead that follows the ring's curve, full ring width, ends matching
							// the rounded-ends flag — so it reads as a slice of the fill, not a straight line.
							const centerAng = posToAngle(p)
							const halfAng = Math.max(1, ringWidthPx * markerW) / 2 / arcRadius
							layer.arcStroke(cx, cy, arcRadius, centerAng - halfAng, centerAng + halfAng, false, {
								color: markerColor,
								width: ringWidthPx,
								cap,
							})
						} else if (isHorizontal) {
							const mx = posToX(p)
							layer.line(mx, bandCenter - fillHalf, mx, bandCenter + fillHalf, {
								color: markerColor,
								width: Math.max(1, crossFull * markerW),
								cap,
							})
						} else {
							const my = posToY(p)
							layer.line(bandCenter - fillHalf, my, bandCenter + fillHalf, my, {
								color: markerColor,
								width: Math.max(1, crossFull * markerW),
								cap,
							})
						}
					}
				}
			})
		})

		return drawBounds
	}

	/**
	 * Draw some bounds lines over the whole image, to give a visual indicator of the selected element
	 * Note: this intentionally overshoots everything to make it very visible
	 */
	static #drawBoundsLines(img: ImageBase<any>, bounds: DrawBounds) {
		const lineStyle: LineStyle = { color: 'rgb(255, 0, 0)', width: 1 } // TODO - what colour is best?

		img.horizontalLine(bounds.y, lineStyle)
		img.horizontalLine(bounds.maxY, lineStyle)

		img.verticalLine(bounds.x, lineStyle)
		img.verticalLine(bounds.maxX, lineStyle)
	}

	static #angleToRadians(angle: number): number {
		const normalizedAngle = (angle + 180) % 360
		return (normalizedAngle / 180) * Math.PI
	}
}
