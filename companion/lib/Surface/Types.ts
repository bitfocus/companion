import type {
	CompanionSurfaceConfigField,
	GridSize,
	SurfaceFirmwareUpdateInfo,
	SurfaceRotation,
} from '@companion-app/shared/Model/Surfaces.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { EventEmitter } from 'events'
import type { CompanionVariableValue, CompanionVariableValues } from '@companion-module/base'
import type { ControlsController } from '../Controls/Controller.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { PageController } from '../Page/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { ExecuteExpressionResult } from '@companion-app/shared/Expression/ExpressionResult.js'
import type { DrawStyleButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type imageRs from '@julusian/image-rs'

export type SurfacePanelFactory = {
	create: (path: string, options: LocalUSBDeviceOptions) => Promise<SurfacePanel>
}

export interface LocalUSBDeviceOptions {
	executeExpression: SurfaceExecuteExpressionFn
}

export type SurfaceExecuteExpressionFn = (
	str: string,
	surfaceId: string,
	injectedVariableValues?: CompanionVariableValues
) => ExecuteExpressionResult

export interface SurfacePanelInfo {
	deviceId: string
	devicePath: string
	type: string
	configFields: CompanionSurfaceConfigField[]
	location?: string
	firmwareUpdateVersionsUrl?: string
	hasFirmwareUpdates?: SurfaceFirmwareUpdateInfo
}

export interface SurfacePanel extends EventEmitter<SurfacePanelEvents> {
	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize
	clearDeck(): void
	draw(item: DrawButtonItem): void
	drawMany?: (entries: DrawButtonItem[]) => void
	setConfig(config: any, force?: boolean): void
	getDefaultConfig?: () => any
	onVariablesChanged?: (allChangedVariables: Set<string>) => void
	quit(): void
	checkForFirmwareUpdates?: (latestVersions?: unknown) => Promise<void>

	/**
	 * If the surface will handle locking display of the locking state itself, this method should be implemented.
	 * If defined, it will be called when the lock state changes.
	 */
	setLocked?: (locked: boolean, characterCount: number) => void
}

export interface DrawButtonItem {
	x: number
	y: number

	type: 'button-layered' | 'button' | 'pageup' | 'pagedown' | 'pagenum' | undefined
	/**
	 * Image draw style
	 */
	style: DrawStyleButtonModel | undefined

	/** @deprecated This should not be necessary */
	defaultRender: ImageResult

	imageFn: (
		width: number,
		height: number,
		rotation: SurfaceRotation | null,
		format: imageRs.PixelFormat
	) => Promise<Buffer>
}

export interface SurfacePanelEvents {
	remove: []
	error: [error: Error]

	click: [x: number, y: number, pressed: boolean, pageOffset?: number]
	rotate: [x: number, y: number, direction: boolean, pageOffset?: number]
	pincodeKey: [key: number]

	setVariable: [variableId: string, value: CompanionVariableValue]
	setCustomVariable: [variableId: string, value: CompanionVariableValue]

	resized: []
}

export interface SurfaceHandlerDependencies {
	/**
	 * The core controls controller
	 */
	readonly controls: ControlsController
	/**
	 * The core graphics controller
	 */
	readonly graphics: GraphicsController
	/**
	 * The core page controller
	 */
	readonly page: PageController
	/**
	 * The core user config manager
	 */
	readonly userconfig: DataUserConfig
	/**
	 * The core variable controller
	 */
	readonly variables: VariablesController
}
