import {
	type ButtonGraphicsBoxDrawElement,
	ButtonGraphicsElementUsage,
	type ButtonGraphicsImageDrawElement,
	type ButtonGraphicsTextDrawElement,
	type ButtonGraphicsDrawBase,
	type SomeButtonGraphicsDrawElement,
	type ButtonGraphicsCanvasDrawElement,
} from '../Model/StyleLayersModel.js'

export interface MatchedElements {
	canvas: ButtonGraphicsCanvasDrawElement | undefined
	text: ButtonGraphicsTextDrawElement | undefined
	box: ButtonGraphicsBoxDrawElement | undefined
	image: ButtonGraphicsImageDrawElement | undefined
}

export class GraphicsLayeredElementUsageMatcher {
	public static SelectBasicLayers(elements: SomeButtonGraphicsDrawElement[]): MatchedElements {
		const canvas = elements.find((e) => e.type === 'canvas')
		const text = GraphicsLayeredElementUsageMatcher.SelectLayerForUsage<ButtonGraphicsTextDrawElement>(
			elements,
			ButtonGraphicsElementUsage.Text,
			'text'
		)
		const box = GraphicsLayeredElementUsageMatcher.SelectLayerForUsage<ButtonGraphicsBoxDrawElement>(
			elements,
			ButtonGraphicsElementUsage.Color,
			'box'
		)
		const image = GraphicsLayeredElementUsageMatcher.SelectLayerForUsage<ButtonGraphicsImageDrawElement>(
			elements,
			ButtonGraphicsElementUsage.Image,
			'image'
		)

		return {
			canvas,
			text,
			box,
			image,
		}
	}

	public static SelectLayerForUsage<TElement extends ButtonGraphicsDrawBase & { type: string }>(
		elements: SomeButtonGraphicsDrawElement[],
		usage: ButtonGraphicsElementUsage,
		layerType: TElement['type']
	): TElement | undefined {
		return (
			GraphicsLayeredElementUsageMatcher.SelectFirstLayerWithUsage<TElement>(elements, usage, layerType) ||
			GraphicsLayeredElementUsageMatcher.SelectFirstLayerOfType<TElement>(elements, layerType)
		)
	}

	private static SelectFirstLayerWithUsage<TElement extends ButtonGraphicsDrawBase & { type: string }>(
		elements: SomeButtonGraphicsDrawElement[],
		usage: ButtonGraphicsElementUsage,
		layerType: TElement['type']
	): TElement | undefined {
		for (const element of elements) {
			if (element.type === 'group') {
				const match = GraphicsLayeredElementUsageMatcher.SelectFirstLayerWithUsage<TElement>(
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
				const match = GraphicsLayeredElementUsageMatcher.SelectFirstLayerOfType<TElement>(element.children, layerType)
				if (match) return match
			} else if (element.type === layerType && element.usage === ButtonGraphicsElementUsage.Automatic) {
				return element as unknown as TElement
			}
		}

		return undefined
	}
}
