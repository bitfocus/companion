import type { RendererButtonStyle } from '../Model/Render.js'
import type {
	ButtonGraphicsBoxDrawElement,
	ButtonGraphicsCanvasDrawElement,
	ButtonGraphicsCircleDrawElement,
	ButtonGraphicsGaugeDrawElement,
	ButtonGraphicsImageDrawElement,
	ButtonGraphicsLineDrawElement,
	ButtonGraphicsTextDrawElement,
	SomeButtonGraphicsDrawElement,
} from '../Model/StyleLayersModel.js'
import { ButtonGraphicsDecorationType } from '../Model/StyleModel.js'
import { assertNever } from '../Util.js'
import { ButtonDecorationRenderer } from './ButtonDecorationRenderer.js'
import { buildGaugeColorModel, type GaugeColorRun, type GaugeRGBA } from './GaugeColorModel.js'
import {
	appendRotation,
	computeSelectionMarkerLines,
	type ElementGeometry,
	type MarkerRotation,
	type SelectedElementMarker,
} from './Geometry.js'
import type { ImageBase, LineStyle } from './ImageBase.js'
import { DrawBounds, parseColor, parseColorAlpha, rgbRev } from './Util.js'

/**
 * Text outline width as a fraction of the font size. Proportional (rather than a fixed pixel value) so
 * the outline keeps a consistent visual weight relative to its text at any button/canvas size. Because
 * it derives from the render-size font size, it is automatically resolution-independent.
 */
const TEXT_OUTLINE_FACTOR = 1 / 16

export class GraphicsLayeredButtonRenderer {
	static #computeTopBarBounds(outerBounds: DrawBounds): DrawBounds {
		return new DrawBounds(
			outerBounds.x,
			outerBounds.y,
			outerBounds.width,
			Math.max(ButtonDecorationRenderer.DEFAULT_HEIGHT, Math.floor(0.2 * outerBounds.height))
		)
	}

	/**
	 * Compute the bounds of the top-level content area (ie the space that root elements' x/y/width/height
	 * fractions are relative to). Exposed so callers (eg the editor's selection overlay) can map between
	 * pixel coordinates and the fractional coordinate space without duplicating this layout math.
	 */
	static computeContentBounds(outerBounds: DrawBounds, decoration: ButtonGraphicsDecorationType): DrawBounds {
		const topBarBounds = this.#computeTopBarBounds(outerBounds)
		const topBarHeight = decoration === ButtonGraphicsDecorationType.TopBar ? topBarBounds.height : 0

		return new DrawBounds(
			outerBounds.x,
			outerBounds.y + topBarHeight,
			outerBounds.width,
			outerBounds.height - topBarHeight
		)
	}

	static async draw(
		img: ImageBase<any>,
		drawStyle: RendererButtonStyle,
		elementsToHide: ReadonlySet<string>,
		selectedElementId: string | null,
		paddingPx: { x: number; y: number }
	): Promise<ElementGeometry[]> {
		const backgroundElement = drawStyle.elements[0]?.type === 'canvas' ? drawStyle.elements[0] : undefined

		// Read the resolved `decoration`, not the raw one off the canvas
		const decoration = drawStyle.decoration

		const outerBounds = new DrawBounds(
			paddingPx.x,
			paddingPx.y,
			img.width - paddingPx.x * 2,
			img.height - paddingPx.y * 2
		)
		const topBarBounds = this.#computeTopBarBounds(outerBounds)
		const drawBounds = this.computeContentBounds(outerBounds, decoration)

		this.#drawBackgroundElement(img, drawBounds, backgroundElement)

		// Clip element drawing to the button rectangle, so that only the markers draw outside the bounds
		const clipBounds = paddingPx.x > 0 || paddingPx.y > 0 ? outerBounds : null
		const elementGeometry: ElementGeometry[] = []
		await img.usingClip(clipBounds, async () =>
			this.#drawElements(img, drawStyle.elements, elementsToHide, drawBounds, false, [], elementGeometry)
		)

		switch (decoration) {
			case ButtonGraphicsDecorationType.None:
				// Do nothing
				break
			case ButtonGraphicsDecorationType.Border:
				ButtonDecorationRenderer.drawBorderWhenPushed(img, drawStyle, drawBounds)
				break
			case ButtonGraphicsDecorationType.TopBar:
				// Clip to the bar so a long location label cannot overflow into the padding around the button
				await img.usingClip(topBarBounds, async () => {
					ButtonDecorationRenderer.drawStatusBar(img, drawStyle, topBarBounds, false)
				})
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
		const selectedMarker = selectedElementId
			? elementGeometry.find((entry) => entry.id === selectedElementId)
			: undefined
		if (selectedMarker) this.#drawBoundsLines(img, selectedMarker)

		return elementGeometry
	}

	/**
	 * Draw the elements to the image, collecting each one's resolved geometry into `out`.
	 *
	 * Geometry is collected for every element, including hidden and disabled ones and the internal
	 * children of references - it describes the layout, and it is up to the caller (the editor) to decide
	 * which elements it cares about. Parents are pushed before their children, so a reverse scan of `out`
	 * finds the top-most element at a point.
	 */
	static async #drawElements(
		img: ImageBase<any>,
		elements: SomeButtonGraphicsDrawElement[],
		elementsToHide: ReadonlySet<string>,
		drawBounds: DrawBounds,
		skipDrawParent: boolean,
		parentRotations: MarkerRotation[],
		out: ElementGeometry[]
	): Promise<void> {
		for (const element of elements) {
			// Skip the background element, it's handled separately
			if (element.type === 'canvas') continue

			const skipDraw = skipDrawParent || elementsToHide.has(element.id) || !element.enabled

			let elementBounds: DrawBounds | null = null
			try {
				switch (element.type) {
					case 'group': {
						// Compute the group's own bounds first so rotation pivots about its centre, not the container's
						let groupBounds = drawBounds.compose(element.x, element.y, element.width, element.height)
						elementBounds = groupBounds // Capture the pre-square bounds

						if (element.squareCoords) {
							const squareSize = Math.min(groupBounds.width, groupBounds.height)
							groupBounds = new DrawBounds(
								groupBounds.x + (groupBounds.width - squareSize) / 2,
								groupBounds.y + (groupBounds.height - squareSize) / 2,
								squareSize,
								squareSize
							)
						}

						// The pivot is the post-square box, matching what `usingRotation` is given below
						const childRotations = appendRotation(parentRotations, groupBounds, element.rotation)
						out.push({ id: element.id, bounds: elementBounds, rotations: childRotations })
						elementBounds = null // Already recorded, with the correct pivot

						await img.usingTemporaryLayer(element.opacity, async (img) => {
							await img.usingRotation(groupBounds, element.rotation, async () => {
								await this.#drawElements(
									img,
									element.children,
									elementsToHide,
									groupBounds,
									skipDraw,
									childRotations,
									out
								)
							})
						})
						break
					}
					case 'reference': {
						// Compute the reference's own bounds first so rotation pivots about its centre, not the container's
						const referenceBounds = drawBounds.compose(element.x, element.y, element.width, element.height)

						const childRotations = appendRotation(parentRotations, referenceBounds, element.rotation)
						out.push({ id: element.id, bounds: referenceBounds, rotations: childRotations })

						await img.usingTemporaryLayer(element.opacity, async (img) => {
							await img.usingRotation(referenceBounds, element.rotation, async () => {
								await this.#drawElements(
									img,
									element.children,
									elementsToHide,
									referenceBounds,
									skipDraw,
									childRotations,
									out
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

			// Groups and references record themselves above, so their pivot can be the box they actually
			// rotated about. Everything else rotates about its own bounds.
			if (elementBounds) {
				const rotation = 'rotation' in element ? element.rotation : 0
				out.push({
					id: element.id,
					bounds: elementBounds,
					rotations: appendRotation(parentRotations, elementBounds, rotation),
				})
			}
		}
	}

	static #drawBackgroundElement(
		_img: ImageBase<any>,
		_drawBounds: DrawBounds,
		backgroundElement: ButtonGraphicsCanvasDrawElement | undefined
	) {
		if (!backgroundElement) return

		// img.box(drawBounds.x, drawBounds.y, drawBounds.maxX, drawBounds.maxY, parseColor(backgroundElement.color))
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
					img.drawAlignedText(x, textY, width, maxY - textY, 'image error', '#ffffff', maxY - textY, {
						allowShrink: true,
					})
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

		// Force some padding around the text, scaled proportionally
		const marginScale = 0.015
		const marginX = 2 * marginScale * drawBounds.width
		const marginY = 1 * marginScale * drawBounds.height
		const innerHeight = drawBounds.height - 2 * marginY

		// Draw button text
		// Scale font so the size is a percentage of the (inner) draw height, where 100% fills the
		// line box exactly. Divide by the font's real line-box ratio (fontBoundingBox height / em) so
		// this holds per-font, and vertical alignment produces no visual change at 100%.
		const italic = element.styles.includes('italic')
		const lineBoxRatio = img.getFontLineBoxRatio(element.font, element.weight, italic)
		const fontSize = (element.fontsize * innerHeight) / 100 / lineBoxRatio

		await img.usingTemporaryLayer(element.opacity, async (img) => {
			await img.usingRotation(drawBounds, element.rotation, async () => {
				img.drawAlignedText(
					drawBounds.x + marginX,
					drawBounds.y + marginY,
					drawBounds.width - 2 * marginX,
					innerHeight,
					element.text,
					parseColor(element.color),
					fontSize,
					{
						allowShrink: element.fontsizeAllowShrink,
						halign: element.halign,
						valign: element.valign,
						outlineStyle:
							parseColorAlpha(element.outlineColor) > 0
								? {
										width: fontSize * TEXT_OUTLINE_FACTOR,
										color: parseColor(element.outlineColor),
									}
								: undefined,
						font: element.font,
						weight: element.weight,
						italic: italic,
						underline: element.styles.includes('underline'),
						strikethrough: element.styles.includes('strikethrough'),
					}
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

		// Corner radius is a fraction of half the shorter side, so 100% gives fully-rounded corners
		const cornerRadius =
			Math.max(0, Math.min(element.cornerRadius, 1)) * (Math.min(drawBounds.width, drawBounds.height) / 2)

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
					element.borderPosition,
					cornerRadius
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

		// Line thickness in pixels (min 1) - used both to stroke the line and to pad the selection bounds.
		const borderWidth = Math.max(1, Math.max(parentBounds.width, parentBounds.height) * element.borderWidth)

		// Selection bounds from the line's bounding box, but keep each axis at least the line's thickness so a
		// horizontal/vertical line (whose box is zero-height/width) isn't hidden right under the marker. Only the
		// degenerate axis grows, so a near-square line doesn't jump as it tips one way or the other.
		const minX = Math.min(fromX, toX)
		const minY = Math.min(fromY, toY)
		const maxX = Math.max(fromX, toX)
		const maxY = Math.max(fromY, toY)
		const halfW = Math.max(maxX - minX, borderWidth) / 2
		const halfH = Math.max(maxY - minY, borderWidth) / 2
		const midX = (minX + maxX) / 2
		const midY = (minY + maxY) / 2
		const drawBounds = new DrawBounds(midX - halfW, midY - halfH, halfW * 2, halfH * 2)

		if (skipDraw) return drawBounds

		// A zero width hides the line; the 1px floor above is only to keep thin (but non-zero) lines visible
		if (element.borderWidth <= 0) return drawBounds

		// The stroke is centred on the path; shift it perpendicular by half its width to sit left/right of it
		let ox = 0
		let oy = 0
		if (element.borderPosition !== 'center') {
			const length = Math.hypot(toX - fromX, toY - fromY)
			if (length > 0) {
				// Unit vector to the right of travel is (-dy, dx); left is the negation
				const sign = element.borderPosition === 'right' ? 1 : -1
				ox = (sign * -(toY - fromY) * borderWidth) / (2 * length)
				oy = (sign * (toX - fromX) * borderWidth) / (2 * length)
			}
		}

		await img.usingAlpha(element.opacity, async () => {
			img.line(fromX + ox, fromY + oy, toX + ox, toY + oy, {
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

		// Shared value/color model (0–100 track-position space): the fill interval, color runs and
		// fill color. This also drives the LED baker (`bakeGaugeToLeds`), so LEDs match the pixels.
		// The trivial per-element flags/geometry (above + below) stay local to the renderer.
		const model = buildGaugeColorModel(element)
		if (!model) return drawBounds
		const { valuePos, fillStart, fillEnd, hasFill, trackAmount, runs, singleColor, rgbaAt } = model

		const trackWidth = Math.max(0, Math.min(100, finite(element.trackWidth, 100))) / 100
		const fillWidth = Math.max(0, Math.min(100, finite(element.fillWidth, 100))) / 100

		const cssOf = (c: GaugeRGBA): string => `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${c.a})`
		// Track (unfilled) color. 'transparent' base colors are emitted at full alpha and composited
		// through a temporary layer at trackAmount; 'dimmed' darkens the color in place.
		const trackTransform = (c: GaugeRGBA): GaugeRGBA => {
			if (trackStyle === 'transparent') return c
			return { r: c.r * trackAmount, g: c.g * trackAmount, b: c.b * trackAmount, a: c.a }
		}

		// --- Geometry helpers shared by fill, track and marker passes. ---
		const isRing = orientation === 'ring'
		const isHorizontal = orientation === 'horizontal'

		// Cross-axis geometry. The fill (indicator) and unfilled track are each narrowed by their own
		// width setting (fillWidth / trackWidth), both centred, so either can be drawn wider than the other.
		const crossFull = isHorizontal ? height : width
		const fillHalf = (crossFull * fillWidth) / 2
		const trackHalf = (crossFull * trackWidth) / 2
		const bandCenter = isHorizontal ? y + height / 2 : x + width / 2

		const markerW = Math.max(1, Math.min(100, finite(element.markerWidth, 15))) / 100

		// The marker is centred on the value, so at value min/max half of it would overhang the ends and make
		// the gauge look bigger than the same gauge at another value. Inset the value's travel by half a marker
		// at each end so the marker stays inside; the runs at the very ends still extend to the true edge (via
		// `mapX/mapY/mapAngle` below) so the track fills the whole gauge with whatever colour is there.
		const travelLen = isHorizontal ? width : height
		const linearInset = element.markerEnabled ? Math.min(Math.max(1, crossFull * markerW) / 2, travelLen / 2) : 0

		// `*Full` maps to the true ends (p=0 → start edge, p=100 → end edge); the plain maps inset the value's
		// travel by the marker half-width. `atEdge` picks the true edge for run ends that sit at 0/100.
		const atEdge = (p: number): boolean => p <= 1e-6 || p >= 100 - 1e-6
		const posToXFull = (p: number): number => (reverse ? maxX - (p / 100) * width : x + (p / 100) * width)
		const posToYFull = (p: number): number => (reverse ? y + (p / 100) * height : maxY - (p / 100) * height)
		const posToX = (p: number): number =>
			reverse
				? maxX - linearInset - (p / 100) * (width - 2 * linearInset)
				: x + linearInset + (p / 100) * (width - 2 * linearInset)
		const posToY = (p: number): number =>
			reverse
				? y + linearInset + (p / 100) * (height - 2 * linearInset)
				: maxY - linearInset - (p / 100) * (height - 2 * linearInset)
		const mapX = (p: number): number => (atEdge(p) ? posToXFull(p) : posToX(p))
		const mapY = (p: number): number => (atEdge(p) ? posToYFull(p) : posToY(p))

		// Ring geometry.
		const cx = x + width / 2
		const cy = y + height / 2
		const outerRadius = Math.min(width, height) / 2
		const ringWidthPx = outerRadius * (element.ringWidth / 100)
		const arcRadius = outerRadius - ringWidthPx / 2
		// Ring stroke widths: fill and track are each narrowed by their own width setting.
		const fillStrokePx = ringWidthPx * fillWidth
		const trackStrokePx = ringWidthPx * trackWidth
		// Arc span: clockwise from startAngle to endAngle (degrees, 0 = top). 0 span → full circle.
		const startAngleDeg = finite(element.startAngle, 0)
		const endAngleDeg = finite(element.endAngle, 360)
		let sweepDeg = (((endAngleDeg - startAngleDeg) % 360) + 360) % 360
		if (sweepDeg === 0) sweepDeg = 360
		const sweepRad = (sweepDeg * Math.PI) / 180
		const degToRad = (deg: number): number => -Math.PI / 2 + (deg * Math.PI) / 180
		// Inset the ring's angular travel by the marker bead's half-angle, same reasoning as the linear inset.
		const ringInset = element.markerEnabled
			? Math.min(Math.max(1, ringWidthPx * markerW) / 2 / arcRadius, sweepRad / 2)
			: 0
		const ringInsetFrac = sweepRad > 0 ? ringInset / sweepRad : 0
		// p=0 at startAngle, p=100 at endAngle (clockwise). reverse flips which end is p=0.
		const posToAngleFull = (p: number): number => degToRad(startAngleDeg + (reverse ? 1 - p / 100 : p / 100) * sweepDeg)
		const posToAngle = (p: number): number => {
			const t = (reverse ? 1 - p / 100 : p / 100) * (1 - 2 * ringInsetFrac) + ringInsetFrac
			return degToRad(startAngleDeg + t * sweepDeg)
		}
		const mapAngle = (p: number): number => (atEdge(p) ? posToAngleFull(p) : posToAngle(p))

		// A cross-axis band to paint an interval into, expressed as a single interval [lo, hi] on the cross
		// axis: for a ring that axis is the radius (so the band is a stroke from radius `lo` out to `hi`),
		// for a linear gauge it is the pixel coordinate across the bar. The fill and track each have their
		// own band, and when the track is wider than the fill it also gets flanking strips.
		type GaugeBand = { lo: number; hi: number }
		const fillBand: GaugeBand = isRing
			? { lo: arcRadius - fillStrokePx / 2, hi: arcRadius + fillStrokePx / 2 }
			: { lo: bandCenter - fillHalf, hi: bandCenter + fillHalf }
		const trackBand: GaugeBand = isRing
			? { lo: arcRadius - trackStrokePx / 2, hi: arcRadius + trackStrokePx / 2 }
			: { lo: bandCenter - trackHalf, hi: bandCenter + trackHalf }

		// When the track is wider than the fill, the filled region shows the track as strips flanking
		// the fill rather than a gap — but never directly behind the fill, so the fill's own alpha stays
		// true (nothing composites underneath it). The strips are the parts of the track band left
		// uncovered by the fill band, so they fall out as a plain interval subtraction.
		const trackSideBands: GaugeBand[] = []
		if (trackBand.lo < fillBand.lo - 1e-6) trackSideBands.push({ lo: trackBand.lo, hi: fillBand.lo })
		if (trackBand.hi > fillBand.hi + 1e-6) trackSideBands.push({ lo: fillBand.hi, hi: trackBand.hi })

		// Paint a single position-space interval [a, b] with one solid color onto `target`, into `band`.
		const paintSolid = (target: ImageBase<any>, a: number, b: number, color: string, band: GaugeBand): void => {
			if (b - a <= 1e-6) return
			const { lo, hi } = band
			if (hi - lo <= 0) return
			if (isRing) {
				const r1 = mapAngle(a)
				const r2 = mapAngle(b)
				target.arcStroke(cx, cy, (lo + hi) / 2, Math.min(r1, r2), Math.max(r1, r2), false, {
					color,
					width: hi - lo,
				})
			} else {
				if (isHorizontal) {
					const xa = mapX(a)
					const xb = mapX(b)
					target.box(Math.round(Math.min(xa, xb)), lo, Math.round(Math.max(xa, xb)), hi, color)
				} else {
					const ya = mapY(a)
					const yb = mapY(b)
					target.box(lo, Math.round(Math.min(ya, yb)), hi, Math.round(Math.max(ya, yb)), color)
				}
			}
		}

		// Approximate the pixel length of an interval, to choose a gradient sub-step count.
		const pixelLen = (a: number, b: number): number => {
			if (isRing) return arcRadius * Math.abs(posToAngle(b) - posToAngle(a))
			return isHorizontal ? Math.abs(posToX(b) - posToX(a)) : Math.abs(posToY(b) - posToY(a))
		}

		// Paint an interval [a, b] of a run onto `target`, applying a color transform.
		const paintRunInterval = (
			target: ImageBase<any>,
			a: number,
			b: number,
			run: GaugeColorRun,
			transform: (c: GaugeRGBA) => GaugeRGBA,
			band: GaugeBand
		): void => {
			if (b - a <= 1e-6) return
			const steps = run.gradient ? Math.max(1, Math.min(64, Math.ceil(pixelLen(a, b) / 2))) : 1
			for (let s = 0; s < steps; s++) {
				const sa = a + ((b - a) * s) / steps
				const sb = a + ((b - a) * (s + 1)) / steps
				paintSolid(target, sa, sb, cssOf(transform(rgbaAt(run, (sa + sb) / 2))), band)
			}
		}

		await img.usingTemporaryLayer(element.opacity, async (layer) => {
			await layer.usingRotation(drawBounds, element.rotation, async () => {
				// Whether the ring forms a complete circle (no ends to round).
				const fullCircle = isRing && sweepDeg >= 360 && fillStart <= 1e-6 && fillEnd >= 100 - 1e-6
				const partialRing = isRing && sweepDeg < 360

				// --- Track pass: the full-width track outside the fill, plus flanking strips beside a
				//     narrower fill inside the filled region (never directly behind the fill). ---
				const paintTrack = (target: ImageBase<any>) => {
					for (const run of runs) {
						const leftHi = Math.min(run.end, hasFill ? fillStart : run.end)
						if (leftHi > run.start) paintRunInterval(target, run.start, leftHi, run, trackTransform, trackBand)
						if (hasFill) {
							const rightLo = Math.max(run.start, fillEnd)
							if (run.end > rightLo) paintRunInterval(target, rightLo, run.end, run, trackTransform, trackBand)

							// Flanking strips beside a fill that is narrower than the track.
							if (trackSideBands.length > 0) {
								const fLo = Math.max(run.start, fillStart)
								const fHi = Math.min(run.end, fillEnd)
								if (fHi > fLo) {
									for (const strip of trackSideBands) {
										paintRunInterval(target, fLo, fHi, run, trackTransform, strip)
									}
								}
							}
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
							const ang = mapAngle(p)
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

				// --- Fill pass: the active portion of each run, at the fill width. ---
				if (hasFill) {
					for (const run of runs) {
						const aLo = Math.max(run.start, fillStart)
						const aHi = Math.min(run.end, fillEnd)
						if (aHi <= aLo) continue
						if (multiColour) {
							paintRunInterval(layer, aLo, aHi, run, (c) => c, fillBand)
						} else {
							paintSolid(layer, aLo, aHi, parseColor(singleColor), fillBand)
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
							// Use whichever stop color the position is closer to.
							return span > 0 && p - run.start > span / 2 ? run.colorEnd : run.colorStart
						}
						for (const p of [fillStart, fillEnd]) {
							const ang = mapAngle(p)
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

				// --- Marker pass: a single-color line at the value, spanning the full fill width. ---
				if (element.markerEnabled) {
					const markerColor = parseColor(element.markerColor)
					const cap: CanvasLineCap = element.roundedEnds ? 'round' : 'butt'
					// The marker follows the value: its leading edge(s). In symmetric mode that's both
					// fill edges; otherwise the single value position.
					const positions = symmetric ? [fillStart, fillEnd] : [valuePos]
					for (const rawP of positions) {
						const p = Math.max(0, Math.min(100, rawP))
						if (isRing) {
							// A short arc bead that follows the ring's curve, matching the fill width, ends matching
							// the rounded-ends flag — so it reads as a slice of the fill, not a straight line.
							const centerAng = posToAngle(p)
							const halfAng = Math.max(1, ringWidthPx * markerW) / 2 / arcRadius
							layer.arcStroke(cx, cy, arcRadius, centerAng - halfAng, centerAng + halfAng, false, {
								color: markerColor,
								width: fillStrokePx,
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
	 * Draw the selection marker for the selected element: its four bounds edges as lines that follow the
	 * element's rotation and extend across the whole image (intentionally overshooting to be very visible).
	 */
	static #drawBoundsLines(img: ImageBase<any>, marker: SelectedElementMarker) {
		const lineStyle: LineStyle = { color: 'rgb(255, 0, 0)', width: 1 } // TODO - what color is best?

		// Outset by half the line width so the marker sits just outside the element (its inner edge on the
		// bound) rather than straddling it and covering the element's own edge pixels.
		const outset = lineStyle.width / 2
		for (const [x1, y1, x2, y2] of computeSelectionMarkerLines(marker, img.width, img.height, outset)) {
			img.line(x1, y1, x2, y2, lineStyle)
		}
	}

	static #angleToRadians(angle: number): number {
		const normalizedAngle = (angle + 180) % 360
		return (normalizedAngle / 180) * Math.PI
	}
}
