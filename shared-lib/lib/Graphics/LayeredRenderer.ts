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
import type { ImageBase, LineStyle } from './ImageBase.js'
import { DrawBounds, parseColor, rgbRev } from './Util.js'

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

		let decoration = backgroundElement?.decoration
		if (decoration === ButtonGraphicsDecorationType.FollowDefault || decoration === undefined) {
			decoration = drawStyle.show_topbar ? ButtonGraphicsDecorationType.TopBar : ButtonGraphicsDecorationType.Border
		}
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
								width: 2, // Fixed width for now, maybe should be dynamic
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

		const sorted = [...element.thresholds].sort((a, b) => Number(a.value) - Number(b.value))
		if (sorted.length === 0) return drawBounds

		const { x, y, width, height, maxX, maxY } = drawBounds
		const { orientation, reverse, multiSegment, inactiveStyle } = element

		// Clamp gauge-level numbers to valid finite ranges so downstream math never sees NaN.
		const value = Number.isFinite(element.value) ? Math.max(0, Math.min(100, element.value)) : 0
		const inactiveAmount = Number.isFinite(element.inactiveAmount)
			? Math.max(0, Math.min(100, element.inactiveAmount))
			: 0

		// Sanitize a threshold numeric field: coerce to finite, clamp to 0–100.
		const safeThreshVal = (v: unknown): number => {
			const n = Number(v)
			return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0
		}
		// Sanitize a color field: coerce to finite, fall back to black.
		const safeColor = (v: unknown): number => {
			const n = Number(v)
			return Number.isFinite(n) ? n : 0
		}

		// For single-color mode, find the highest threshold whose start <= current value
		let singleActiveColor = safeColor(sorted[0].color)
		if (!multiSegment) {
			for (const t of sorted) {
				if (safeThreshVal(t.value) <= value) singleActiveColor = safeColor(t.color)
			}
		}

		// Convert a gauge position range [p1, p2] (0–100) to pixel box coordinates [x1, y1, x2, y2].
		// Coordinates are rounded to the nearest integer so that adjacent segments always share an
		// exact pixel edge and anti-aliasing does not leave a visible seam between them.
		const segmentBox = (p1: number, p2: number): [number, number, number, number] => {
			if (orientation === 'horizontal') {
				return reverse
					? [Math.round(maxX - (p2 / 100) * width), y, Math.round(maxX - (p1 / 100) * width), maxY]
					: [Math.round(x + (p1 / 100) * width), y, Math.round(x + (p2 / 100) * width), maxY]
			} else {
				return reverse
					? [x, Math.round(y + (p1 / 100) * height), maxX, Math.round(y + (p2 / 100) * height)]
					: [x, Math.round(maxY - (p2 / 100) * height), maxX, Math.round(maxY - (p1 / 100) * height)]
			}
		}

		const dimmedColor = (color: number): string => {
			const { r, g, b, a } = rgbRev(color, true)
			const factor = inactiveAmount / 100
			if (inactiveStyle === 'transparent') {
				return `rgba(${r}, ${g}, ${b}, ${a * factor})`
			} else {
				return `rgba(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)}, ${a})`
			}
		}

		await img.usingTemporaryLayer(element.opacity, async (img) => {
			await img.usingRotation(drawBounds, element.rotation, async () => {
				if (orientation === 'ring') {
					const cx = x + width / 2
					const cy = y + height / 2
					const outerRadius = Math.min(width, height) / 2
					const thicknessPx = outerRadius * (element.thickness / 100)
					const arcRadius = outerRadius - thicknessPx / 2

					// p=0 → top (−π/2); CW increases, CCW decreases
					const posToAngle = (p: number) => -Math.PI / 2 + (reverse ? -1 : 1) * (p / 100) * (Math.PI * 2)

					// Pass 1: inactive arcs.
					// Drawn into a temporary layer so that anti-aliased arc endpoints at threshold
					// boundaries don't accumulate alpha and produce bright seams. Each arc is
					// painted at full opacity on the temp layer; the layer is then composited onto
					// the main canvas at the desired transparency in a single operation.
					const drawInactiveArcs = (target: ImageBase<any>) => {
						for (let i = 0; i < sorted.length; i++) {
							const segStart = safeThreshVal(sorted[i].value)
							const segEnd = i + 1 < sorted.length ? safeThreshVal(sorted[i + 1].value) : 100
							const color = safeColor(sorted[i].color)
							if (segStart >= segEnd) continue

							const inactiveStart = Math.max(segStart, value)
							if (inactiveStart < segEnd) {
								const [a1, a2] = reverse
									? [posToAngle(segEnd), posToAngle(inactiveStart)]
									: [posToAngle(inactiveStart), posToAngle(segEnd)]
								// Always use the base colour at full opacity on this layer — the
								// transparency / darkening is applied when compositing the layer.
								target.arcStroke(cx, cy, arcRadius, a1, a2, false, {
									color: inactiveStyle === 'transparent' ? parseColor(color) : dimmedColor(color),
									width: thicknessPx,
								})
							}
						}
					}

					if (inactiveStyle === 'transparent') {
						await img.usingTemporaryLayer(inactiveAmount / 100, async (layer) => {
							drawInactiveArcs(layer)
						})
					} else {
						drawInactiveArcs(img)
					}

					// Pass 2: active arcs (always fully opaque, drawn directly).
					for (let i = 0; i < sorted.length; i++) {
						const segStart = safeThreshVal(sorted[i].value)
						const segEnd = i + 1 < sorted.length ? safeThreshVal(sorted[i + 1].value) : 100
						const color = safeColor(sorted[i].color)
						if (segStart >= segEnd) continue

						const activeEnd = Math.min(segEnd, value)
						if (activeEnd > segStart) {
							const activeColor = multiSegment ? color : singleActiveColor
							const [a1, a2] = reverse
								? [posToAngle(activeEnd), posToAngle(segStart)]
								: [posToAngle(segStart), posToAngle(activeEnd)]
							img.arcStroke(cx, cy, arcRadius, a1, a2, false, {
								color: parseColor(activeColor),
								width: thicknessPx,
							})
						}
					}

					// Rounded end-caps on the active arc, except when value=100 (complete circle has no ends)
					if (element.roundedEnds && value > 0 && value < 100) {
						const capRadius = thicknessPx / 2

						// Cap at position 0: colour of the first active threshold
						const startColor = multiSegment ? Number(sorted[0].color) : singleActiveColor
						const startAngle = posToAngle(0)
						img.circle(
							cx + arcRadius * Math.cos(startAngle),
							cy + arcRadius * Math.sin(startAngle),
							capRadius,
							capRadius,
							0,
							Math.PI * 2,
							false,
							parseColor(startColor)
						)

						// Cap at position=value: colour of whichever threshold the value falls in
						const endThreshold = [...sorted].reverse().find((t) => Number(t.value) <= value)
						const endColor = multiSegment
							? endThreshold
								? Number(endThreshold.color)
								: Number(sorted[0].color)
							: singleActiveColor
						const endAngle = posToAngle(value)
						img.circle(
							cx + arcRadius * Math.cos(endAngle),
							cy + arcRadius * Math.sin(endAngle),
							capRadius,
							capRadius,
							0,
							Math.PI * 2,
							false,
							parseColor(endColor)
						)
					}
				} else {
					for (let i = 0; i < sorted.length; i++) {
						const segStart = safeThreshVal(sorted[i].value)
						const segEnd = i + 1 < sorted.length ? safeThreshVal(sorted[i + 1].value) : 100
						const color = safeColor(sorted[i].color)

						if (segStart >= segEnd) continue

						// Active portion: segStart → min(segEnd, value)
						const activeEnd = Math.min(segEnd, value)
						if (activeEnd > segStart) {
							const activeColor = multiSegment ? color : singleActiveColor
							img.box(...segmentBox(segStart, activeEnd), parseColor(activeColor))
						}

						// Inactive portion: max(segStart, value) → segEnd
						const inactiveStart = Math.max(segStart, value)
						if (inactiveStart < segEnd) {
							img.box(...segmentBox(inactiveStart, segEnd), dimmedColor(color))
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
