import type { EventEmitter } from 'node:events'
import type { ExecuteExpressionResult } from '@companion-app/shared/ExpressionResult.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { EmulatorListItem, EmulatorPageConfig } from '@companion-app/shared/Model/Emulator.js'
import type {
	ClientSurfaceButtonSizesItem,
	ClientSurfaceLayoutItem,
	CompanionSurfaceConfigField,
	GridSize,
	SurfaceAppearanceDefinition,
	SurfaceFirmwareUpdateInfo,
	SurfaceGroupConfig,
	SurfaceModelsUpdate,
	SurfaceSchemaLayoutDefinition,
	SurfacesUpdate,
} from '@companion-app/shared/Model/Surfaces.js'
import type { VariableValue } from '@companion-app/shared/Model/Variables.js'
import type { SurfaceControlEvent } from '@companion-surface/base'
import type { IControlStore } from '../Controls/IControlStore.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { IPageStore } from '../Page/Store.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { EmulatorUpdateEvents } from './IP/ElgatoEmulator.js'

export type SurfaceExecuteExpressionFn = (str: string, surfaceId: string) => ExecuteExpressionResult

export interface SurfacePanelInfo {
	surfaceId: string
	description: string
	configFields: CompanionSurfaceConfigField[]
	location: string | null
	isRemote: boolean
	hasFirmwareUpdates?: SurfaceFirmwareUpdateInfo
	canChangePage?: boolean
	/** Whether this opened device wants control events, such as a press running actions */
	supportsControlEvents?: boolean
}

export interface SurfacePanel extends EventEmitter<SurfacePanelEvents> {
	readonly instanceId?: string // Future: make required

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize
	/** The layout manifest describing the controls this panel has, and how they are drawn */
	readonly surfaceLayout: SurfaceSchemaLayoutDefinition
	/** How to draw the panel's face; null when it supplied none and the face is derived from the layout */
	readonly surfaceAppearance: SurfaceAppearanceDefinition | null
	/** Which of its module's declared models the panel is, by the id the module declared it with; null for none */
	readonly surfaceModelId: string | null
	clearDeck(): void
	draw(item: DrawButtonItem): void
	setConfig(config: any, force?: boolean): void
	onVariablesChanged?: (allChangedVariables: ReadonlySet<string>) => void
	quit(): void
	/**
	 * Tell the device about an event on the control(s) at this position, in panel coordinates.
	 * Only called when info.supportsControlEvents is set. Best-effort: errors are contained and nothing is replayed.
	 */
	controlEvent?: (x: number, y: number, event: SurfaceControlEvent) => void

	/**
	 * If the surface will handle locking display of the locking state itself, this method should be implemented.
	 * If defined, it will be called when the lock state changes.
	 */
	setLocked: (locked: boolean, characterCount: number) => void
}

export interface DrawButtonItem {
	x: number
	y: number

	defaultRender: ImageResult

	/** The absolute page/row/column location of the button being drawn, if known */
	location: ControlLocation | null
}

export interface SurfacePanelEvents {
	remove: []
	error: [error: Error]

	click: [x: number, y: number, pressed: boolean, pageOffset?: number]
	rotate: [x: number, y: number, delta: number, pageOffset?: number]
	changePage: [forward: boolean]
	pincodeKey: [key: number]

	setCustomVariable: [variableId: string, value: VariableValue]

	firmwareUpdateInfo: []

	/** The grid size, layout or appearance of the surface has changed */
	resized: []
}

export interface SurfaceHandlerDependencies {
	/**
	 * The core controls controller
	 */
	readonly controls: IControlStore
	/**
	 * The core graphics controller
	 */
	readonly graphics: GraphicsController
	/**
	 * The core page store
	 */
	readonly pageStore: IPageStore
	/**
	 * The core user config manager
	 */
	readonly userconfig: DataUserConfig
	/**
	 * The core variable controller
	 */
	readonly variables: VariablesController
}

export type UpdateEvents = EmulatorUpdateEvents & {
	emulatorPageConfig: [info: EmulatorPageConfig]
	emulatorList: [list: EmulatorListItem[]]

	surfaces: [changes: SurfacesUpdate[]]
	surfaceLayouts: [layouts: Record<string, ClientSurfaceLayoutItem>]
	surfaceModels: [changes: SurfaceModelsUpdate[]]
	surfaceButtonSizes: [sizes: Record<string, ClientSurfaceButtonSizesItem>]

	[id: `groupConfig:${string}`]: [config: SurfaceGroupConfig | null]
}
