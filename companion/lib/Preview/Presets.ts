import type { ClientSocket } from '../UI/Handler.js'
import type { VariablesValues } from '../Variables/Values.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { InstanceDefinitions } from '../Instance/Definitions.js'
import LogController from '../Log/Controller.js'

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

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('preview:render-preset', async (connectionId, presetId) => {
			const style = this.#instanceDefinitions.getPresetDrawStyle(connectionId, presetId)
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
		})
	}
}
