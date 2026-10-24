import {
	SurfaceConfigSchema,
	SurfacePanelConfigSchema,
	type SurfaceConfig,
	type SurfacePanelConfig,
} from '@companion-app/shared/Model/Surfaces.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { SurfacePanel } from './Types.js'

export const PanelDefaults: SurfacePanelConfig = SurfacePanelConfigSchema.parse({})

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
		// Use existing config, or the defaults for a new surface
		...(existingConfig ?? SurfaceConfigSchema.parse({})),

		config: panelConfig,

		// Persist some values in the db for use when it is disconnected
		type: panel.info.description || 'Unknown',
		integrationType,
		gridSize: panel.gridSize,
		layout: panel.surfaceLayout,
		appearance: panel.surfaceAppearance,
		modelId: panel.surfaceModelId,
		lastSeen: Date.now(),
	}

	return newConfig
}
