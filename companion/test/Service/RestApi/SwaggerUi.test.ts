import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { getSwaggerUiAssetPath, getSwaggerUiHtmlPath } from '../../../lib/Service/RestApi/SwaggerUi.js'

afterEach(() => {
	vi.unstubAllEnvs()
})

describe('Swagger UI asset paths', () => {
	test('serves repository assets directly in development', () => {
		vi.stubEnv('COMPANION_BUNDLED', '0')

		const htmlPath = getSwaggerUiHtmlPath()

		expect(htmlPath).toBe(path.join(import.meta.dirname, '../../../../assets/swagger-ui'))
		expect(fs.existsSync(htmlPath)).toBe(true)
		expect(getSwaggerUiAssetPath()).toContain('swagger-ui-dist')
	})

	test('serves copied distribution assets when packaged', () => {
		vi.stubEnv('COMPANION_BUNDLED', '1')

		expect(getSwaggerUiHtmlPath()).toBe(getSwaggerUiAssetPath())
	})
})
