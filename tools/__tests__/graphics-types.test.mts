import { readFile } from 'node:fs/promises'
import prettier from 'prettier'
import { expect, test } from 'vitest'
import { generatedGraphicsTypes, graphicsTypesPath } from '../generate_graphics_types.mts'

test('the generated graphics types are up to date, else run `yarn build:graphics-types`', async () => {
	const options = await prettier.resolveConfig(graphicsTypesPath)
	const expected = await prettier.format(generatedGraphicsTypes, { ...options, filepath: graphicsTypesPath })

	expect(await readFile(graphicsTypesPath, 'utf8')).toBe(expected)
})
