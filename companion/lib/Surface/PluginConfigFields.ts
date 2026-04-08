import type { CompanionSurfaceConfigField } from '@companion-app/shared/Model/Surfaces.js'
import type { Logger } from '../Log/Controller.js'

export const PluginConfigFieldPrefix = 'plugin_cfg_'

export function sanitizePluginConfigFields(
	logger: Logger,
	configFields: CompanionSurfaceConfigField[] | null | undefined
): CompanionSurfaceConfigField[] {
	const fields: CompanionSurfaceConfigField[] = []
	const seenExternalIds = new Set<string>()

	for (const field of configFields ?? []) {
		if (seenExternalIds.has(field.id)) {
			logger.warn(`Ignoring duplicate plugin config field "${field.id}"`)
			continue
		}
		seenExternalIds.add(field.id)

		fields.push({
			...field,
			id: `${PluginConfigFieldPrefix}${field.id}`,
		})
	}

	return fields
}

/**
 * Build the config payload that is sent to the surface module.
 *
 * This intentionally emits ONLY fields declared by the client. Companion-owned
 * fields are not included here.
 */
export function createSurfaceConfigPayload(
	configFields: CompanionSurfaceConfigField[] | null | undefined,
	config: Record<string, any>
): Record<string, any> {
	const surfaceConfig: Record<string, any> = {}

	for (const field of configFields ?? []) {
		if (!field.id.startsWith(PluginConfigFieldPrefix)) continue
		if (!Object.hasOwn(config, field.id)) continue

		surfaceConfig[field.id.slice(PluginConfigFieldPrefix.length)] = config[field.id]
	}

	return surfaceConfig
}
