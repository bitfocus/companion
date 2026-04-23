import type { SurfaceConfig, SurfacePanelConfig } from '@companion-app/shared/Model/Surfaces.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { SurfacePanel } from './Types.js'

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

export function createDefaultSurfacePanelConfig(panel: SurfacePanel): SurfacePanelConfig {
	const panelConfig = structuredClone(PanelDefaults)

	// Add properties and defaults from the panel UI definitions
	for (const cfield of panel.info.configFields) {
		if (!(cfield.id in panelConfig) || 'default' in cfield) {
			panelConfig[cfield.id] = cfield.default
		}
	}

	return panelConfig
}

export function createOrSanitizeSurfaceHandlerConfig(
	integrationType: string,
	panel: SurfacePanel,
	existingConfig: SurfaceConfig | undefined,
	gridSize: UserConfigGridSize
): SurfaceConfig {
	const panelDefaultConfig = createDefaultSurfacePanelConfig(panel)

	// Retrieve or create the panel config
	let panelConfig = existingConfig?.config
	if (!panelConfig) {
		panelConfig = panelDefaultConfig

		panelConfig.xOffset = Math.max(0, gridSize.minColumn)
		panelConfig.yOffset = Math.max(0, gridSize.minRow)
	} else {
		// check for new properties but don't change existing fields
		for (const [key, value] of Object.entries(panelDefaultConfig)) {
			if (!(key in panelConfig)) {
				panelConfig[key] = structuredClone(value)
			}
		}
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

		// Default enabled to true (existing configs without this field are treated as enabled)
		enabled: true,

		// Use existing config
		...existingConfig,

		config: panelConfig,

		// Persist some values in the db for use when it is disconnected
		type: panel.info.description || 'Unknown',
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
