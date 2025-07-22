import type { ControlsController } from '../Controls/Controller.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import { PreviewExpressionStream } from './ExpressionStream.js'
import { PreviewGraphics } from './Graphics.js'
import { router } from '../UI/TRPC.js'
import type EventEmitter from 'node:events'
import type { ControlCommonEvents } from '../Controls/ControlDependencies.js'

export class PreviewController {
	readonly #graphics: PreviewGraphics
	readonly #expressionStream: PreviewExpressionStream

	constructor(
		graphicsController: GraphicsController,
		pageStore: IPageStore,
		controlsController: ControlsController,
		controlEvents: EventEmitter<ControlCommonEvents>
	) {
		this.#graphics = new PreviewGraphics(graphicsController, pageStore, controlsController, controlEvents)
		this.#expressionStream = new PreviewExpressionStream(controlsController)
	}

	createTrpcRouter() {
		return router({
			graphics: this.#graphics.createTrpcRouter(),
			expressionStream: this.#expressionStream.createTrpcRouter(),
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
