import type { DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type { Complete } from '@companion-module/base/dist/util.js'
import { ImageResultProcessedStyle } from './ImageResult.js'
import { GraphicsLayeredElementUsageMatcher } from '@companion-app/shared/Graphics/LayeredElementUsageMatcher.js'

export class GraphicsLayeredProcessedStyleGenerator {
	static Generate(drawStyle: DrawStyleLayeredButtonModel): ImageResultProcessedStyle {
		const selectedElements = GraphicsLayeredElementUsageMatcher.SelectBasicLayers(drawStyle.elements)

		let showTopBar: boolean | 'default' = 'default'
		if (selectedElements.canvas) {
			switch (selectedElements.canvas.decoration) {
				case 'topbar':
					showTopBar = true
					break
				case 'border':
					showTopBar = false
					break
				default:
					showTopBar = 'default'
					break
			}
		}

		const processedStyle: Complete<ImageResultProcessedStyle> = {
			type: 'button',
			color: selectedElements.box ? { color: selectedElements.box.color } : undefined,
			text: selectedElements.text
				? {
						text: selectedElements.text.text,
						color: selectedElements.text.color,
						size: Number(selectedElements.text.fontsize) || 'auto', // TODO - scale value?
						halign: selectedElements.text.halign,
						valign: selectedElements.text.valign,
					}
				: undefined,
			png64: selectedElements.image?.base64Image
				? {
						dataUrl: selectedElements.image.base64Image,
						halign: selectedElements.image.halign,
						valign: selectedElements.image.valign,
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
}
