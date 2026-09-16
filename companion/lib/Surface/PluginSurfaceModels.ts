import { stringifyError } from '@companion-app/shared/Stringify.js'
import {
	appearanceCoversLayout,
	validateSurfaceAppearance,
	validateSurfaceLayout,
	type SurfaceAppearanceDefinition,
} from '@companion-surface/base'
import type { IpcSurfaceModel } from '../Instance/Surface/IpcTypes.js'
import type { Logger } from '../Log/Controller.js'

/**
 * Validate the models a plugin declared before they are stored. A model with no usable id or name, or whose layout
 * does not hold up, is dropped whole; an appearance is optional, so a bad or incomplete one is dropped but its model
 * kept. They arrive from another process, so nothing about their shape is taken on trust - one bad model must not
 * take down the list of every module's models.
 */
export function sanitizeSurfaceModels(logger: Logger, models: IpcSurfaceModel[]): IpcSurfaceModel[] {
	const sanitized: IpcSurfaceModel[] = []

	for (const model of models) {
		if (!hasIdAndName(model)) {
			logger.warn(`Ignoring a model with no usable id or name`)
			continue
		}

		try {
			validateSurfaceLayout(model.layout)
		} catch (e) {
			logger.warn(`Ignoring model "${model.id}" with an invalid layout: ${stringifyError(e)}`)
			continue
		}

		sanitized.push({ ...model, appearance: sanitizeSurfaceAppearance(logger, model) })
	}

	return sanitized
}

function hasIdAndName(model: unknown): model is Pick<IpcSurfaceModel, 'id' | 'name'> {
	if (!model || typeof model !== 'object') return false

	const { id, name } = model as Record<string, unknown>
	return typeof id === 'string' && id.length > 0 && typeof name === 'string' && name.length > 0
}

function sanitizeSurfaceAppearance(logger: Logger, model: IpcSurfaceModel): SurfaceAppearanceDefinition | undefined {
	const appearance = model.appearance
	if (appearance === undefined) return undefined

	try {
		validateSurfaceAppearance(appearance)
	} catch (e) {
		logger.warn(`Ignoring the appearance of model "${model.id}": ${stringifyError(e)}`)
		return undefined
	}

	// An appearance which does not place every control is all-or-nothing, so drop it whole
	const uncovered = appearanceCoversLayout(model.layout, appearance)
	if (uncovered.length > 0) {
		logger.warn(`Ignoring the appearance of model "${model.id}", it is missing controls: ${uncovered.join(', ')}`)
		return undefined
	}

	return appearance
}
