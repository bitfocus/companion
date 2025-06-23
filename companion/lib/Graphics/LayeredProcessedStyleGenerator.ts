import {
	ButtonGraphicsTextDrawElement,
	ButtonGraphicsElementUsage,
	ButtonGraphicsBoxDrawElement,
	ButtonGraphicsDrawBase,
	SomeButtonGraphicsDrawElement,
	ButtonGraphicsImageDrawElement,
	ButtonGraphicsDecorationType,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import type { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type { Complete } from '@companion-module/base/dist/util.js'
import { ImageResultProcessedStyle } from './ImageResult.js'

export class GraphicsLayeredProcessedStyleGenerator {
	static Generate(drawStyle: DrawStyleLayeredButtonModel): ImageResultProcessedStyle {
		const canvasLayer = drawStyle.elements.find((e) => e.type === 'canvas')
		const textLayer = GraphicsLayeredProcessedStyleGenerator.SelectLayerForUsage<ButtonGraphicsTextDrawElement>(
			drawStyle.elements,
			ButtonGraphicsElementUsage.Text,
			'text'
		)
		const boxLayer = GraphicsLayeredProcessedStyleGenerator.SelectLayerForUsage<ButtonGraphicsBoxDrawElement>(
			drawStyle.elements,
			ButtonGraphicsElementUsage.Color,
			'box'
		)
		const imageLayer = GraphicsLayeredProcessedStyleGenerator.SelectLayerForUsage<ButtonGraphicsImageDrawElement>(
			drawStyle.elements,
			ButtonGraphicsElementUsage.Image,
			'image'
		)

		let showTopBar: boolean | 'default' = 'default'
		if (canvasLayer) {
			switch (canvasLayer.decoration) {
				case ButtonGraphicsDecorationType.TopBar:
					showTopBar = true
					break
				case ButtonGraphicsDecorationType.Border:
					showTopBar = false
					break
				default:
					showTopBar = 'default'
					break
			}
		}

		const processedStyle: Complete<ImageResultProcessedStyle> = {
			type: 'button',
			color: boxLayer ? { color: boxLayer.color } : undefined,
			text: textLayer
				? {
						text: textLayer.text,
						color: textLayer.color,
						size: Number(textLayer.fontsize) || 'auto', // TODO - scale value?
						halign: textLayer.halign,
						valign: textLayer.valign,
					}
				: undefined,
			png64: imageLayer?.base64Image
				? {
						dataUrl: imageLayer.base64Image,
						halign: imageLayer.halign,
						valign: imageLayer.valign,
					}
				: undefined,
			state: {
				pushed: drawStyle.pushed,
				showTopBar: showTopBar,
				cloud: drawStyle.cloud || false,
			},
		}

		return processedStyle
	}

	private static SelectLayerForUsage<TElement extends ButtonGraphicsDrawBase & { type: string }>(
		elements: SomeButtonGraphicsDrawElement[],
		usage: ButtonGraphicsElementUsage,
		layerType: TElement['type']
	): TElement | undefined {
		return (
			GraphicsLayeredProcessedStyleGenerator.SelectFirstLayerWithUsage<TElement>(elements, usage, layerType) ||
			GraphicsLayeredProcessedStyleGenerator.SelectFirstLayerOfType<TElement>(elements, layerType)
		)
	}

	private static SelectFirstLayerWithUsage<TElement extends ButtonGraphicsDrawBase & { type: string }>(
		elements: SomeButtonGraphicsDrawElement[],
		usage: ButtonGraphicsElementUsage,
		layerType: TElement['type']
	): TElement | undefined {
		for (const element of elements) {
			if (element.type === 'group') {
				const match = GraphicsLayeredProcessedStyleGenerator.SelectFirstLayerWithUsage<TElement>(
					element.children,
					usage,
					layerType
				)
				if (match) return match
			} else if (element.type === layerType && element.usage === usage) {
				return element as unknown as TElement
			}
		}

		return undefined
	}

	private static SelectFirstLayerOfType<TElement extends ButtonGraphicsDrawBase & { type: string }>(
		elements: SomeButtonGraphicsDrawElement[],
		layerType: TElement['type']
	): TElement | undefined {
		for (const element of elements) {
			if (element.type === 'group') {
				const match = GraphicsLayeredProcessedStyleGenerator.SelectFirstLayerOfType<TElement>(
					element.children,
					layerType
				)
				if (match) return match
			} else if (element.type === layerType && element.usage === ButtonGraphicsElementUsage.Automatic) {
				return element as unknown as TElement
			}
		}

		return undefined
	}
}
