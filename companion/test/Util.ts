import { afterAll, beforeAll } from 'vitest'
import LogController from '../lib/Log/Controller.js'

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
