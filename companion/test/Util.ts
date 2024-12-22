import LogController from '../lib/Log/Controller.js'
import { afterAll, beforeAll } from 'vitest'

export function SuppressLogging() {
	let originalLogLevel: string = 'silly'
	beforeAll(() => {
		originalLogLevel = LogController.getLogLevel()
		LogController.setLogLevel('error')
	})
	afterAll(() => {
		LogController.setLogLevel(originalLogLevel)
	})
}
