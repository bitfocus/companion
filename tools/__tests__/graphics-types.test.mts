import { readFile } from 'node:fs/promises'
import prettier from 'prettier'
import { expect, test } from 'vitest'
import { generatedGraphicsTypes, graphicsTypesPath } from '../generate_graphics_types.mts'

test('the generated graphics types are up to date, else run `yarn build:graphics-types`', async () => {
	const options = await prettier.resolveConfig(graphicsTypesPath)
	const expected = await prettier.format(generatedGraphicsTypes, { ...options, filepath: graphicsTypesPath })

	// A Windows checkout can have CRLF line endings
	const actual = (await readFile(graphicsTypesPath, 'utf8')).replaceAll('\r\n', '\n')
	expect(actual).toBe(expected)
})
