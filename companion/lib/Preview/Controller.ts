import type { ControlsController } from '../Controls/Controller.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { VariablesValues } from '../Variables/Values.js'
import type { InstanceDefinitions } from '../Instance/Definitions.js'
import { PreviewExpressionStream } from './ExpressionStream.js'
import { PreviewGraphics } from './Graphics.js'
import { PreviewPresets } from './Presets.js'

export class PreviewController {
	readonly #graphics: PreviewGraphics
	readonly #expressionStream: PreviewExpressionStream
	readonly #presets: PreviewPresets

	constructor(
		graphicsController: GraphicsController,
		ioController: UIHandler,
		pageStore: IPageStore,
		controlsController: ControlsController,
		variablesValuesController: VariablesValues,
		instanceDefinitions: InstanceDefinitions
	) {
		this.#graphics = new PreviewGraphics(graphicsController, ioController, pageStore, controlsController)
		this.#expressionStream = new PreviewExpressionStream(
			ioController,
			pageStore,
			variablesValuesController,
			controlsController
		)
		this.#presets = new PreviewPresets(graphicsController, variablesValuesController, instanceDefinitions)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		this.#graphics.clientConnect(client)
		this.#expressionStream.clientConnect(client)
		this.#presets.clientConnect(client)
	}

	onControlIdsLocationChanged(controlIds: string[]): void {
		this.#graphics.onControlIdsLocationChanged(controlIds)
	}

	onVariablesChanged(allChangedSet: Set<string>, fromControlId: string | null): void {
		this.#graphics.onVariablesChanged(allChangedSet, fromControlId)
	}
}
