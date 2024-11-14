import type {
	CompanionSurfaceConfigField,
	GridSize,
	SurfaceFirmwareUpdateInfo,
} from '@companion-app/shared/Model/Surfaces.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { EventEmitter } from 'events'
import type { CompanionVariableValue, CompanionVariableValues } from '@companion-module/base'
import type { ControlsController } from '../Controls/Controller.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { PageController } from '../Page/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'

export type SurfacePanelFactory = {
	create: (path: string, options: LocalUSBDeviceOptions) => Promise<SurfacePanel>
}

export interface LocalUSBDeviceOptions {
	executeExpression: SurfaceExecuteExpressionFn
	useLegacyLayout?: boolean
}

export type SurfaceExecuteExpressionFn = (
	str: string,
	surfaceId: string,
	injectedVariableValues?: CompanionVariableValues
) => { value: CompanionVariableValue | undefined; variableIds: Set<string> }

export interface SurfacePanelInfo {
	deviceId: string
	devicePath: string
	type: string
	configFields: CompanionSurfaceConfigField[]
	location?: string
	hasFirmwareUpdates?: SurfaceFirmwareUpdateInfo
}

export interface SurfacePanel extends EventEmitter<SurfacePanelEvents> {
	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize
	clearDeck(): void
	draw(x: number, y: number, render: ImageResult): void
	drawMany?: (entries: DrawButtonItem[]) => void
	drawColor?: (pageOffset: number, x: number, y: number, color: number) => void
	setConfig(config: any, force?: boolean): void
	getDefaultConfig?: () => any
	onVariablesChanged?: (allChangedVariables: Set<string>) => void
	quit(): void
	checkForFirmwareUpdates?: (latestVersions?: Record<string, string>) => Promise<void>
}
export interface DrawButtonItem {
	x: number
	y: number
	image: ImageResult
}

export interface SurfacePanelEvents {
	remove: []
	error: [error: Error]

	click: [x: number, y: number, pressed: boolean, pageOffset?: number]
	rotate: [x: number, y: number, direction: boolean]

	setVariable: [variableId: string, value: CompanionVariableValue]
	setCustomVariable: [variableId: string, value: CompanionVariableValue]

	resized: []

	/** @deprecated */
	'xkeys-subscribePage': [pageCount: number]
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
