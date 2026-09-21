import { describe, expect, test } from 'vitest'
import type { SurfaceSchemaLayoutDefinition } from '@companion-app/shared/Model/Surfaces.js'
import type { IpcSurfaceModel } from '../../lib/Instance/Surface/IpcTypes.js'
import type { Logger } from '../../lib/Log/Controller.js'
import { sanitizeSurfaceModels } from '../../lib/Surface/PluginSurfaceModels.js'

const xlLayout: SurfaceSchemaLayoutDefinition = {
	stylePresets: { default: { bitmap: { w: 96, h: 96 } } },
	controls: {
		'0/0': { row: 0, column: 0 },
		'0/1': { row: 0, column: 1 },
	},
}

const fullAppearance = {
	size: { width: 20, height: 10 },
	bodyColor: '#000000',
	controls: {
		'0/0': { x: 0, y: 0, width: 10, height: 10 },
		'0/1': { x: 10, y: 0, width: 10, height: 10 },
	},
}

function createLogger(): { logger: Logger; warnings: string[] } {
	const warnings: string[] = []
	const logger = {
		error: () => {},
		warn: (message: string) => warnings.push(message),
		info: () => {},
		debug: () => {},
	} as unknown as Logger
	return { logger, warnings }
}

function model(overrides: Partial<IpcSurfaceModel>): IpcSurfaceModel {
	return { id: 'xl', name: 'Stream Deck XL', layout: xlLayout, appearance: undefined, ...overrides }
}

describe('sanitizeSurfaceModels', () => {
	test('keeps a model with a valid layout and no appearance, untouched', () => {
		const { logger, warnings } = createLogger()

		expect(sanitizeSurfaceModels(logger, [model({})])).toEqual([model({})])
		expect(warnings).toEqual([])
	})

	test('drops a model whose layout does not match the schema, but keeps the rest', () => {
		const { logger, warnings } = createLogger()

		const result = sanitizeSurfaceModels(logger, [
			model({ id: 'bad', layout: { controls: {} } as unknown as SurfaceSchemaLayoutDefinition }),
			model({ id: 'good' }),
		])

		expect(result.map((m) => m.id)).toEqual(['good'])
		expect(warnings).toHaveLength(1)
		expect(warnings[0]).toContain('bad')
	})

	test('keeps a valid appearance that places every control', () => {
		const { logger, warnings } = createLogger()

		const result = sanitizeSurfaceModels(logger, [model({ appearance: fullAppearance })])

		expect(result[0].appearance).toEqual(fullAppearance)
		expect(warnings).toEqual([])
	})

	test('keeps the model but drops an appearance which does not match the schema', () => {
		const { logger, warnings } = createLogger()

		const result = sanitizeSurfaceModels(logger, [
			model({ appearance: { size: { width: 20, height: 10 } } as unknown as typeof fullAppearance }),
		])

		expect(result).toHaveLength(1)
		expect(result[0].appearance).toBeUndefined()
		expect(warnings).toHaveLength(1)
	})

	test('drops an appearance which leaves some of the layout controls unplaced', () => {
		const { logger, warnings } = createLogger()

		const partialAppearance = {
			size: { width: 20, height: 10 },
			bodyColor: '#000000',
			controls: { '0/0': { x: 0, y: 0, width: 10, height: 10 } },
		}
		const result = sanitizeSurfaceModels(logger, [model({ appearance: partialAppearance })])

		expect(result[0].appearance).toBeUndefined()
		expect(warnings).toHaveLength(1)
		expect(warnings[0]).toContain('0/1')
	})
})
