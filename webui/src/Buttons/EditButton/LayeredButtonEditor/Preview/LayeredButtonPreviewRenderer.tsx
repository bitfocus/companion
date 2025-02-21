import { observer } from 'mobx-react-lite'
import React, { useEffect, useRef, useState } from 'react'
import { useLayeredButtonDrawStyleParser } from './DrawStyleParser.js'
import { LayeredStyleStore } from '../StyleStore.js'
import { GraphicsImage } from './Image.js'
import { GraphicsLayeredButtonRenderer } from '@companion-app/shared/Graphics/LayeredRenderer.js'
import { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { PromiseDebounce } from '@companion-app/shared/PromiseDebounce.js'
import { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'

interface LayeredButtonPreviewRendererProps {
	controlId: string
	styleStore: LayeredStyleStore
}
export const LayeredButtonPreviewRenderer = observer(function LayeredButtonPreviewRenderer({
	controlId,
	styleStore,
}: LayeredButtonPreviewRendererProps) {
	const drawStyle = useLayeredButtonDrawStyleParser(controlId, styleStore)

	return (
		<div>
			<LayeredButtonCanvas width={200} height={200} drawStyle={drawStyle} hiddenElements={styleStore.hiddenElements} />
			&nbsp;&nbsp;
			<LayeredButtonCanvas width={144} height={112} drawStyle={drawStyle} hiddenElements={styleStore.hiddenElements} />
			&nbsp;&nbsp;
			<LayeredButtonCanvas width={100} height={200} drawStyle={drawStyle} hiddenElements={styleStore.hiddenElements} />
		</div>
	)
})

interface LayeredButtonCanvasProps {
	width: number
	height: number
	drawStyle: SomeButtonGraphicsDrawElement[] | null
	hiddenElements: ReadonlySet<string>
}
function LayeredButtonCanvas({ width, height, drawStyle, hiddenElements }: LayeredButtonCanvasProps) {
	const drawContext = useRef<RendererDrawContext | null>(null)

	const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
	useEffect(() => {
		console.log('draw!', Date.now())

		if (!canvas || !drawStyle) return

		// Setup the context on the first run
		if (!drawContext.current) drawContext.current = new RendererDrawContext(canvas)

		// Update any cached properties
		drawContext.current.setHiddenElements(hiddenElements)

		// Pass the new draw style to the context
		const drawStyleFull: DrawStyleLayeredButtonModel = {
			style: 'button-layered',

			elements: drawStyle,

			pushed: false,
			step_cycle: undefined,
			cloud: undefined,
			cloud_error: undefined,
			button_status: 'warning',
			action_running: true,
		}
		drawContext.current.draw(drawStyleFull)
	}, [canvas, drawStyle, hiddenElements])

	return (
		<canvas
			// Use the dimensions as a key to force a redraw when they change
			key={`${width}x${height}`}
			ref={setCanvas}
			width={width}
			height={height}
		/>
	)
}

class RendererDrawContext {
	readonly #image: GraphicsImage
	readonly #debounce: PromiseDebounce
	readonly location: ControlLocation | undefined = undefined // TODO - populate this?

	#hiddenElements: ReadonlySet<string>

	constructor(canvas: HTMLCanvasElement) {
		const image = GraphicsImage.create(canvas)
		if (!image) throw new Error('Failed to create image')

		this.#image = image
		this.#debounce = new PromiseDebounce(this.#debounceDraw, 1)
		this.#hiddenElements = new Set()
	}

	#lastDrawStyle: DrawStyleLayeredButtonModel | null = null
	#debounceDraw = async () => {
		try {
			if (!this.#lastDrawStyle) throw new Error('No draw style!')

			this.#image.fillColor('#000000')

			await GraphicsLayeredButtonRenderer.draw(
				this.#image,
				{
					page_direction_flipped: false,
					page_plusminus: false,
					remove_topbar: false,
				},
				this.#lastDrawStyle,
				this.location,
				this.#hiddenElements
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

	draw(drawStyleFull: DrawStyleLayeredButtonModel) {
		this.#lastDrawStyle = drawStyleFull
		this.#debounce.trigger()
	}
}
