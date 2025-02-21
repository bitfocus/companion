import { observer } from 'mobx-react-lite'
import React, { useEffect, useRef, useState } from 'react'
import { useLayeredButtonDrawStyleParser } from './DrawStyleParser.js'
import { LayeredStyleStore } from '../StyleStore.js'
import { GraphicsImage } from './Image.js'
import { GraphicsLayeredButtonRenderer } from '@companion-app/shared/Graphics/LayeredRenderer.js'
import { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'

interface LayeredButtonPreviewRendererProps {
	controlId: string
	styleStore: LayeredStyleStore
}
export const LayeredButtonPreviewRenderer = observer(function LayeredButtonPreviewRenderer({
	controlId,
	styleStore,
}: LayeredButtonPreviewRendererProps) {
	const drawStyle = useLayeredButtonDrawStyleParser(controlId, styleStore)

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

			drawCache.current = { image }
		}

		const { image } = drawCache.current

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

		try {
			image.fillColor('#000000')
			GraphicsLayeredButtonRenderer.draw(
				image,
				{
					page_direction_flipped: false,
					page_plusminus: false,
					remove_topbar: false,
				},
				drawStyleFull,
				location
			)
		} catch (e) {
			console.error('draw failed!', e)
		}
	}, [canvas, drawStyle])

	return (
		<div>
			<canvas ref={setCanvas} width={200} height={200} />

			{/* <code>{drawStyle ? JSON.stringify(drawStyle, undefined, 4) : 'no data'}</code> */}
		</div>
	)
})

interface RendererDrawCache {
	image: GraphicsImage
}
