import type { AppInfo } from '../Registry.js'
import type { PageController } from '../Page/Controller.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { CompanionVariableValue } from '@companion-module/base'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { DrawStyleModel } from '@companion-app/shared/Model/StyleModel.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { GraphicsController } from '../Graphics/Controller.js'

/**
 * Class providing an abstract api for consumption by services.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 4.0.0
 * @copyright 2025 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export class ServiceApi {
	readonly #appInfo: AppInfo
	readonly #pageController: PageController
	readonly #controlController: ControlsController
	readonly #surfaceController: SurfaceController
	readonly #variablesController: VariablesController
	readonly #graphicsController: GraphicsController

	get appInfo(): AppInfo {
		return this.#appInfo
	}

	constructor(
		appInfo: AppInfo,
		pageController: PageController,
		controlController: ControlsController,
		surfaceController: SurfaceController,
		variablesController: VariablesController,
		graphicsController: GraphicsController
	) {
		this.#appInfo = appInfo
		this.#pageController = pageController
		this.#controlController = controlController
		this.#surfaceController = surfaceController
		this.#variablesController = variablesController
		this.#graphicsController = graphicsController
	}

	/**
	 * Set the value of a custom variable
	 * @param name
	 * @param value
	 * @returns Failure reason, if any
	 */
	setCustomVariableValue(name: string, value: CompanionVariableValue): string | null {
		return this.#variablesController.custom.setValue(name, value)
	}

	/**
	 * Get the value of a custom variable
	 * @param name
	 * @returns The value of the variable
	 */
	getCustomVariableValue(name: string): CompanionVariableValue | undefined {
		return this.#variablesController.custom.getValue(name)
	}

	/**
	 * Get the value of a connection variable
	 * @param connectionLabel
	 * @param variableName
	 * @returns The value of the variable
	 */
	getConnectionVariableValue(connectionLabel: string, variableName: string): CompanionVariableValue | undefined {
		return this.#variablesController.values.getVariableValue(connectionLabel, variableName)
	}

	async triggerRescanForSurfaces(): Promise<void> {
		await this.#surfaceController.triggerRefreshDevices()
	}

	/**
	 * Get the if ot the control at the given page and bank index
	 */
	getControlIdAtOldBankIndex(page: number, bank: number): string | null {
		return this.#pageController.getControlIdAtOldBankIndex(page, bank)
	}

	/**
	 * Get the id of the control at the given location
	 */
	getControlIdAt(location: ControlLocation): string | null {
		return this.#pageController.getControlIdAt(location)
	}

	pressControl(controlId: string, pressed: boolean, surfaceId: string): boolean {
		return this.#controlController.pressControl(controlId, pressed, surfaceId)
	}

	rotateControl(controlId: string, direction: boolean, surfaceId: string): boolean {
		return this.#controlController.rotateControl(controlId, direction, surfaceId)
	}

	getControl(controlId: string): ServiceApiControl | null {
		const control = this.#controlController.getControl(controlId)
		if (!control) return null

		return {
			controlId,

			setCurrentStep: control.supportsActionSets ? (step) => control.actionSets.stepMakeCurrent(step) : undefined,

			getDrawStyle: control.supportsStyle ? () => control.getDrawStyle() : undefined,
			setStyleFields: control.supportsStyle ? (diff) => control.styleSetFields(diff) : undefined,
		}
	}

	/**
	 * Get the page id for a given page number
	 */
	getPageIdForNumber(pageNumber: number): string | null {
		return this.#pageController.getPageInfo(pageNumber)?.id ?? null
	}

	getPageNumberForId(pageId: string): number | null {
		return this.#pageController.getPageNumber(pageId)
	}

	getFirstPageId(): string {
		return this.#pageController.getFirstPageId()
	}

	surfaceSetPage(surfaceId: string, pageId: string): void {
		this.#surfaceController.devicePageSet(surfaceId, pageId)
	}

	surfacePageUp(surfaceId: string): void {
		this.#surfaceController.devicePageUp(surfaceId)
	}
	surfacePageDown(surfaceId: string): void {
		this.#surfaceController.devicePageDown(surfaceId)
	}

	getCachedRenderOrGeneratePlaceholder(location: ControlLocation): ImageResult {
		return this.#graphicsController.getCachedRenderOrGeneratePlaceholder(location)
	}
}

export interface ServiceApiControl {
	readonly controlId: string

	setCurrentStep: ((step: number) => boolean) | undefined

	getDrawStyle: (() => DrawStyleModel | null) | undefined
	setStyleFields: ((diff: Record<string, any>) => void) | undefined
}
