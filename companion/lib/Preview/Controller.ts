import type { ControlsController } from '../Controls/Controller.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { VariablesValues } from '../Variables/Values.js'
import type { InstanceDefinitions } from '../Instance/Definitions.js'
import { PreviewExpressionStream } from './ExpressionStream.js'
import { PreviewGraphics } from './Graphics.js'
import { PreviewPresets } from './Presets.js'
import { router } from '../UI/TRPC.js'

export class PreviewController {
	readonly #graphics: PreviewGraphics
	readonly #expressionStream: PreviewExpressionStream
	readonly #presets: PreviewPresets

	constructor(
		graphicsController: GraphicsController,
		pageStore: IPageStore,
		controlsController: ControlsController,
		variablesValuesController: VariablesValues,
		instanceDefinitions: InstanceDefinitions
	) {
		this.#graphics = new PreviewGraphics(graphicsController, pageStore, controlsController)
		this.#expressionStream = new PreviewExpressionStream(pageStore, controlsController)
		this.#presets = new PreviewPresets(graphicsController, variablesValuesController, instanceDefinitions)
	}

	createTrpcRouter() {
		return router({
			graphics: this.#graphics.createTrpcRouter(),
			expressionStream: this.#expressionStream.createTrpcRouter(),
			presets: this.#presets.createTrpcRouter(),
		})
	}

	onControlIdsLocationChanged(controlIds: string[]): void {
		this.#graphics.onControlIdsLocationChanged(controlIds)
	}

	onVariablesChanged(allChangedSet: Set<string>, fromControlId: string | null): void {
		this.#graphics.onVariablesChanged(allChangedSet, fromControlId)
		this.#expressionStream.onVariablesChanged(allChangedSet, fromControlId)
	}
}
