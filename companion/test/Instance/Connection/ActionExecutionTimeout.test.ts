import { describe, expect, test } from 'vitest'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import {
	DEFAULT_ACTION_EXECUTION_TIMEOUT,
	getActionExecutionTimeout,
	MAX_ACTION_EXECUTION_TIMEOUT,
} from '../../../lib/Instance/Connection/ActionExecutionTimeout.js'

function definitionWithTimeout(actionExecutionTimeout: number | undefined): ClientEntityDefinition {
	return { actionExecutionTimeout } as ClientEntityDefinition
}

describe('getActionExecutionTimeout', () => {
	test('uses the default when the definition does not set one', () => {
		expect(getActionExecutionTimeout(definitionWithTimeout(undefined))).toBe(DEFAULT_ACTION_EXECUTION_TIMEOUT)
	})

	test('uses the timeout the definition asks for', () => {
		expect(getActionExecutionTimeout(definitionWithTimeout(30_000))).toBe(30_000)
	})

	test('allows a timeout shorter than the default', () => {
		expect(getActionExecutionTimeout(definitionWithTimeout(1_000))).toBe(1_000)
	})

	test('caps the timeout at the maximum', () => {
		expect(getActionExecutionTimeout(definitionWithTimeout(MAX_ACTION_EXECUTION_TIMEOUT * 10))).toBe(
			MAX_ACTION_EXECUTION_TIMEOUT
		)
	})
})
