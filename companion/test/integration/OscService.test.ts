import dgram from 'node:dgram'
import osc from 'osc'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import type { ControlButtonLayered } from '../../lib/Controls/ControlTypes/Button/Layered.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

interface OscArg {
	type: string
	value: string | number
}

// The repo's osc type declarations don't cover the encoder
function encodeOscMessage(address: string, args: OscArg[]): Buffer {
	return Buffer.from((osc as any).writeMessage({ address, args }, { metadata: true }))
}

describe('osc api service over a real udp socket', () => {
	let app: TestApp
	let socket: dgram.Socket
	let port: number

	beforeEach(async () => {
		app = await createTestApp({ configDir: null })

		port = 21000 + Math.floor(Math.random() * 20000)
		app.registry.userconfig.setKey('osc_listen_port', port)
		app.registry.userconfig.setKey('osc_enabled', true)

		socket = dgram.createSocket('udp4')
	})
	afterEach(async () => {
		socket.close()
		await app.close()
	})

	/** The service binds on a userconfig fanout tick, so keep sending until the effect is observed */
	async function sendUntil(message: Buffer, assertion: () => void): Promise<void> {
		await vi.waitFor(
			() => {
				socket.send(message, port, '127.0.0.1')
				assertion()
			},
			{ timeout: 5000, interval: 200 }
		)
	}

	test('a custom variable can be set over osc', async () => {
		app.createCustomVariable('osc_var', 'initial')

		await sendUntil(encodeOscMessage('/custom-variable/osc_var/value', [{ type: 's', value: 'hello-osc' }]), () => {
			expect(app.getCustomVariableValue('osc_var')).toBe('hello-osc')
		})
	})

	test('a button can be pressed by location over osc', async () => {
		app.createCustomVariable('osc_press', 'initial')

		const controlId = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		app.addInternalAction(controlId, 'custom_variable_set_value', {
			name: exprVal('osc_press'),
			create: exprVal(false),
			value: exprVal('pressed via osc'),
		})

		await sendUntil(encodeOscMessage('/location/1/1/1/press', []), () => {
			expect(app.getCustomVariableValue('osc_press')).toBe('pressed via osc')
		})
	})

	test('button style can be changed over osc once enabled in the button options', async () => {
		const controlId = app.createButton({ pageNumber: 1, row: 1, column: 2 })
		const control = app.registry.controls.getControl(controlId) as ControlButtonLayered
		control.optionsSetField('canModifyStyleInApis', true)

		await sendUntil(encodeOscMessage('/location/1/1/2/style/text', [{ type: 's', value: 'via osc' }]), () => {
			expect(control.drawing.getElementById('text0')).toMatchObject({ text: { isExpression: false, value: 'via osc' } })
		})
	})
})
