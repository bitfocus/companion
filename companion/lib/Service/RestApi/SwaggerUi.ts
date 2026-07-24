import { createRequire } from 'node:module'
import path from 'node:path'
import Express from 'express'
import { isPackaged } from '../../Resources/Util.js'

const require = createRequire(import.meta.url)

export function getSwaggerUiHtmlPath(): string {
	if (!isPackaged()) {
		return path.join(import.meta.dirname, '../../../../assets/swagger-ui')
	}

	return path.join(import.meta.dirname, 'assets', 'swagger-ui')
}

export function getSwaggerUiAssetPath(): string {
	if (isPackaged()) {
		return path.join(import.meta.dirname, 'assets', 'swagger-ui')
	}

	return path.dirname(require.resolve('swagger-ui-dist/swagger-ui.css'))
}

export function createSwaggerUiRouter(): Express.Router {
	const router = Express.Router()
	const htmlPath = getSwaggerUiHtmlPath()
	const assetPath = getSwaggerUiAssetPath()

	router.use(Express.static(htmlPath, { index: 'index.html' }))
	router.use(Express.static(assetPath, { index: false }))

	return router
}
