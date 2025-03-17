import { observer } from 'mobx-react-lite'
import React, { useEffect, useRef, useState } from 'react'
import { useLayeredButtonDrawStyleParser } from './DrawStyleParser.js'
import { LayeredStyleStore } from '../StyleStore.js'
import { GraphicsImage } from './Image.js'
import { GraphicsLayeredButtonRenderer } from '@companion-app/shared/Graphics/LayeredRenderer.js'
import { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { PromiseDebounce } from '@companion-app/shared/PromiseDebounce.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import FontLoader from './FontLoader.js'

const PAD_X = 10
const PAD_Y = 10

interface LayeredButtonPreviewRendererProps {
	controlId: string
	location: ControlLocation
	styleStore: LayeredStyleStore
}
export const LayeredButtonPreviewRenderer = observer(function LayeredButtonPreviewRenderer({
	controlId,
	location,
	styleStore,
}: LayeredButtonPreviewRendererProps) {
	const drawStyle = useLayeredButtonDrawStyleParser(controlId, styleStore)

	// Future: dynamic sizes

	return (
		<LayeredButtonCanvas
			width={200}
			height={200}
			location={location}
			drawStyle={drawStyle}
			hiddenElements={styleStore.hiddenElements}
			selectedElementId={styleStore.selectedElementId}
		/>
	)
})

interface LayeredButtonCanvasProps {
	width: number
	height: number
	location: ControlLocation
	drawStyle: DrawStyleLayeredButtonModel | null
	hiddenElements: ReadonlySet<string>
	selectedElementId: string | null
}
function LayeredButtonCanvas({
	width,
	height,
	location,
	drawStyle,
	hiddenElements,
	selectedElementId,
}: LayeredButtonCanvasProps) {
	const drawContext = useRef<RendererDrawContext | null>(null)

	const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
	useEffect(() => {
		if (!canvas || !drawStyle) return

		// Setup the context on the first run
		if (!drawContext.current) drawContext.current = new RendererDrawContext(canvas, location)

		// Update any cached properties
		drawContext.current.setHiddenElements(hiddenElements)
		drawContext.current.setSelectedElementId(selectedElementId)

		// Pass the new draw style to the context
		drawContext.current.draw(drawStyle)
	}, [canvas, location, drawStyle, hiddenElements, selectedElementId])

	// Ensure the fonts are loaded
	// Future: maybe the first paint should be blocked until either the fonts are loaded, or a timeout is reached?
	useEffect(() => {
		const unsub = FontLoader.listenForFontLoad(() => {
			console.log('font loaded!', Date.now())
			if (drawContext.current) drawContext.current.redraw()
		})

		return () => {
			if (unsub !== 'loaded') {
				// Stop listening for font load events
				return unsub()
			}
		}
	}, [])

	return (
		<canvas
			// Use the dimensions as a key to force a redraw when they change
			key={`${width}x${height}`}
			ref={setCanvas}
			width={width + PAD_X * 2}
			height={height + PAD_Y * 2}
		/>
	)
}

class RendererDrawContext {
	readonly #image: GraphicsImage
	readonly #debounce: PromiseDebounce
	readonly location: ControlLocation

	#hiddenElements: ReadonlySet<string> = new Set()
	#selectedElementId: string | null = null

	constructor(canvas: HTMLCanvasElement, location: ControlLocation) {
		const image = GraphicsImage.create(canvas)
		if (!image) throw new Error('Failed to create image')

		this.#image = image
		this.#debounce = new PromiseDebounce(this.#debounceDraw, 1, 10)
		this.location = location
	}

	#lastDrawStyle: DrawStyleLayeredButtonModel | null = null
	#debounceDraw = async () => {
		try {
			if (!this.#lastDrawStyle) throw new Error('No draw style!')

			this.#image.clear()

			// draw checkerboard
			const box_size = 10
			const max_x = this.#image.width - PAD_X * 2
			const max_y = this.#image.height - PAD_Y * 2
			for (let x = 0; x < Math.ceil(max_x / box_size); x++) {
				for (let y = 0; y < Math.ceil(max_y / box_size); y++) {
					if (x % 2 === y % 2) continue

					const x2 = Math.min(PAD_X + (x + 1) * box_size, max_x + PAD_X)
					const y2 = Math.min(PAD_Y + (y + 1) * box_size, max_y + PAD_Y)

					this.#image.box(PAD_X + x * box_size, PAD_Y + y * box_size, x2, y2, 'rgba(0,0,0,0.1)')
				}
			}

			await GraphicsLayeredButtonRenderer.draw(
				this.#image,
				{
					page_direction_flipped: false,
					page_plusminus: false,
					remove_topbar: false,
				},
				this.#lastDrawStyle,
				this.location,
				this.#hiddenElements,
				this.#selectedElementId,
				{ x: PAD_X, y: PAD_Y }
			)

			this.#image.drawComplete()
		} catch (e) {
			console.error('draw failed!', e)
		}
	}

	setHiddenElements(hiddenElements: ReadonlySet<string>) {
		this.#hiddenElements = hiddenElements
		this.#debounce.trigger()
	}

	setSelectedElementId(selectedElementId: string | null) {
		this.#selectedElementId = selectedElementId
		this.#debounce.trigger()
	}

	draw(drawStyleFull: DrawStyleLayeredButtonModel) {
		this.#lastDrawStyle = drawStyleFull
		this.#debounce.trigger()
	}

	redraw() {
		this.#debounce.trigger()
	}
}
