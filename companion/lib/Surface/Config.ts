import type { SurfaceConfig, SurfacePanelConfig } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfacePanel } from './Types.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { cloneDeep } from 'lodash-es'

export const PanelDefaults: SurfacePanelConfig = {
	// defaults from the panel - TODO properly
	brightness: 100,
	rotation: 0,

	// companion owned defaults
	never_lock: false,
	xOffset: 0,
	yOffset: 0,
	groupId: null,
}

export function createOrSanitizeSurfaceHandlerConfig(
	integrationType: string,
	panel: SurfacePanel,
	existingConfig: SurfaceConfig | undefined,
	gridSize: UserConfigGridSize
): SurfaceConfig {
	// Retrieve or create the panel config
	let panelConfig = existingConfig?.config
	if (!panelConfig) {
		panelConfig = cloneDeep(PanelDefaults)
		if (typeof panel.getDefaultConfig === 'function') {
			Object.assign(panelConfig, panel.getDefaultConfig())
		}

		panelConfig.xOffset = Math.max(0, gridSize.minColumn)
		panelConfig.yOffset = Math.max(0, gridSize.minRow)
	}

	if (panelConfig.xOffset === undefined || panelConfig.yOffset === undefined) {
		// Fill in missing default offsets
		panelConfig.xOffset = Math.max(0, gridSize.minColumn)
		panelConfig.yOffset = Math.max(0, gridSize.minRow)
	}

	const newConfig: SurfaceConfig = {
		// New default groupConfig
		groupConfig: {
			// @ts-expect-error migrate old field
			page: existingConfig?.page ?? 1,
			startup_page: panelConfig.page ?? 1,
			// Fill in the new field based on previous behaviour:
			// If a page had been chosen, then it would start on that
			use_last_page: panelConfig.use_last_page ?? panelConfig.page === undefined,
		},

		// Use existing config
		...existingConfig,

		config: panelConfig,

		// Persist some values in the db for use when it is disconnected
		type: panel.info.type || 'Unknown',
		integrationType,
		gridSize: panel.gridSize,
	}

	// Forget old values
	delete panelConfig.use_last_page
	delete panelConfig.page

	if (existingConfig) {
		// @ts-expect-error old field
		delete existingConfig.page
	}

	return newConfig
}
