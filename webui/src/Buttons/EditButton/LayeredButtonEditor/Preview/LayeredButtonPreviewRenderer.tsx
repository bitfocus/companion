import { observer } from 'mobx-react-lite'
import React, { useEffect, useRef, useState } from 'react'
import { useLayeredButtonDrawStyleParser } from './DrawStyleParser.js'
import { LayeredStyleStore } from '../StyleStore.js'
import { GraphicsImage } from './Image.js'
import { GraphicsLayeredButtonRenderer } from '@companion-app/shared/Graphics/LayeredRenderer.js'
import { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import { PromiseDebounce } from '@companion-app/shared/PromiseDebounce.js'
import { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'

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

interface RendererDrawCache {
	image: GraphicsImage
	debounce: PromiseDebounce<void, [DrawStyleLayeredButtonModel]>
	hiddenElements: ReadonlySet<string>
}

interface LayeredButtonCanvasProps {
	width: number
	height: number
	drawStyle: SomeButtonGraphicsDrawElement[] | null
	hiddenElements: ReadonlySet<string>
}
function LayeredButtonCanvas({ width, height, drawStyle, hiddenElements }: LayeredButtonCanvasProps) {
	const drawCache = useRef<RendererDrawCache | null>(null)

	const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
	useEffect(() => {
		console.log('draw!', Date.now())

		if (!canvas || !drawStyle) return

		if (!drawCache.current) {
			const image = GraphicsImage.create(canvas)
			if (!image) {
				console.error('Failed to create image')
				return
			}

			drawCache.current = {
				image,
				debounce: new PromiseDebounce(async (style) => {
					try {
						image.fillColor('#000000')

						await GraphicsLayeredButtonRenderer.draw(
							image,
							{
								page_direction_flipped: false,
								page_plusminus: false,
								remove_topbar: false,
							},
							style,
							location,
							drawCache.current!.hiddenElements
						)

						image.drawComplete()
					} catch (e) {
						console.error('draw failed!', e)
					}
				}, 1),
				hiddenElements: new Set(),
			}
		}

		// Update any cached properties
		drawCache.current.hiddenElements = hiddenElements

		const { debounce } = drawCache.current

		const location = undefined
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

		debounce.trigger(drawStyleFull)
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
