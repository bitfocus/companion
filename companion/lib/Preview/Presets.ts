import type { VariablesValues } from '../Variables/Values.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { InstanceDefinitions } from '../Instance/Definitions.js'
import LogController from '../Log/Controller.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import z from 'zod'

export class PreviewPresets {
	readonly #logger = LogController.createLogger('Preview/PreviewPreset')

	readonly #graphicsController: GraphicsController
	readonly #variablesValuesController: VariablesValues
	readonly #instanceDefinitions: InstanceDefinitions

	constructor(
		graphics: GraphicsController,
		variablesValues: VariablesValues,
		instanceDefinitions: InstanceDefinitions
	) {
		this.#graphicsController = graphics
		this.#variablesValuesController = variablesValues
		this.#instanceDefinitions = instanceDefinitions
	}

	createTrpcRouter() {
		// const self = this
		return router({
			// renderLive: publicProcedure
			// 	.input(
			// 		z.object({
			// 			connectionId: z.string(),
			// 			presetId: z.string(),
			// 		})
			// 	)
			// 	.subscription(async function* ({ input, signal }) {
			// 		const control = self.#controlsController.getOrCreatePresetControl(input.connectionId, input.presetId)
			// 		if (!control) throw new Error(`Preset "${input.presetId}" not found for connection "${input.connectionId}"`)

			// 		// const style = this.#instanceDefinitions.getPresetDrawStyle(input.connectionId, input.presetId)
			// 		// if (!style) {
			// 		// 	return null
			// 		// }
			// 		// if (style.text) {
			// 		// 	const parser = this.#variablesValuesController.createVariablesAndExpressionParser(null, null, null)
			// 		// 	if (style.textExpression) {
			// 		// 		const parseResult = parser.executeExpression(style.text, undefined)
			// 		// 		if (parseResult.ok) {
			// 		// 			style.text = parseResult.value + ''
			// 		// 		} else {
			// 		// 			this.#logger.error(`Expression parse error: ${parseResult.error}`)
			// 		// 			style.text = 'ERR'
			// 		// 		}
			// 		// 	} else {
			// 		// 		const parseResult = parser.parseVariables(style.text)
			// 		// 		style.text = parseResult.text
			// 		// 	}
			// 		// }
			// 		// const render = await this.#graphicsController.drawPreview(style)
			// 		// if (render) {
			// 		// 	return render.asDataUrl
			// 		// } else {
			// 		// 	return null
			// 		// }
			// 	}),

			render: publicProcedure
				.input(
					z.object({
						connectionId: z.string(),
						presetId: z.string(),
					})
				)
				.query(async ({ input }) => {
					const style = this.#instanceDefinitions.getPresetDrawStyle(input.connectionId, input.presetId)
					if (!style) {
						return null
					}

					if (style.text) {
						const parser = this.#variablesValuesController.createVariablesAndExpressionParser(null, null, null)
						if (style.textExpression) {
							const parseResult = parser.executeExpression(style.text, undefined)
							if (parseResult.ok) {
								style.text = parseResult.value + ''
							} else {
								this.#logger.error(`Expression parse error: ${parseResult.error}`)
								style.text = 'ERR'
							}
						} else {
							const parseResult = parser.parseVariables(style.text)
							style.text = parseResult.text
						}
					}

					const render = await this.#graphicsController.drawPreview(style)
					if (render) {
						return render.asDataUrl
					} else {
						return null
					}
				}),
		})
	}
}
