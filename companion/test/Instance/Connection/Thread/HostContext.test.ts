import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type {
	CompanionPresetDefinitions,
	CompanionPresetSection,
	HostActionDefinition,
	HostFeedbackDefinition,
	HostFeedbackValue,
	HostVariableDefinition,
	HostVariableValue,
} from '@companion-module/host'
import type { ModuleChildIpcWrapper } from '../../../../lib/Instance/Connection/IpcTypesNew.js'
import { HostContext } from '../../../../lib/Instance/Connection/Thread/HostContext.js'

function createHostContext() {
	const sendWithNoCb = vi.fn()
	const sendWithCb = vi.fn()
	const ipcWrapper = { sendWithNoCb, sendWithCb } as unknown as ModuleChildIpcWrapper

	return { hostContext: new HostContext(ipcWrapper, 'conn01', 0), sendWithNoCb, sendWithCb }
}

/** All payloads sent under the given IPC message name, in order */
function payloadsFor(mock: ReturnType<typeof vi.fn>, name: string): any[] {
	return mock.mock.calls.filter(([msg]) => msg === name).map(([, payload]) => payload)
}

/** The payload of the last IPC message sent under the given name */
function lastPayloadFor(mock: ReturnType<typeof vi.fn>, name: string): any {
	const payloads = payloadsFor(mock, name)
	return payloads[payloads.length - 1]
}

describe('HostContext setStatus', () => {
	test('forwards the status and message', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setStatus('ok' as any, 'all good')

		expect(sendWithNoCb).toHaveBeenCalledWith('set-status', { status: 'ok', message: 'all good' })
	})

	test('forwards a null message', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setStatus('connecting' as any, null)

		expect(sendWithNoCb).toHaveBeenCalledWith('set-status', { status: 'connecting', message: null })
	})
})

describe('HostContext setActionDefinitions', () => {
	function actionDefinition(overrides: Partial<HostActionDefinition> = {}): HostActionDefinition {
		return {
			id: 'my-action',
			name: 'My Action',
			sortName: undefined,
			description: 'Does a thing',
			options: [],
			optionsToMonitorForSubscribe: undefined,
			hasLearn: false,
			learnTimeout: undefined,
			hasLifecycleFunctions: false,
			...overrides,
		}
	}

	test('sends an empty map when there are no actions', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setActionDefinitions([])

		expect(lastPayloadFor(sendWithNoCb, 'setActionDefinitions')).toEqual({ actions: {} })
	})

	test('maps a raw action into a client entity definition keyed by id', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setActionDefinitions([
			actionDefinition({
				optionsToMonitorForSubscribe: ['host'],
				hasLearn: true,
				learnTimeout: 5000,
				hasLifecycleFunctions: true,
				hasResult: true,
			}),
		])

		const { actions } = lastPayloadFor(sendWithNoCb, 'setActionDefinitions')
		expect(actions['my-action']).toMatchObject({
			entityType: 'action',
			label: 'My Action',
			description: 'Does a thing',
			sortKey: null,
			options: [],
			optionsToMonitorForInvalidations: ['host'],
			hasLifecycleFunctions: true,
			hasLearn: true,
			learnTimeout: 5000,
			actionHasResult: true,
			showInvert: false,
			showButtonPreview: false,
			feedbackType: null,
			optionsSupportExpressions: true,
		})
	})

	test('coerces optional flags and stringifies a numeric sortName', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setActionDefinitions([actionDefinition({ sortName: 42 as unknown as string })])

		const { actions } = lastPayloadFor(sendWithNoCb, 'setActionDefinitions')
		expect(actions['my-action']).toMatchObject({
			sortKey: '42',
			hasLearn: false,
			hasLifecycleFunctions: false,
			actionHasResult: false,
			optionsToMonitorForInvalidations: null,
		})
	})

	test('translates the action option fields', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setActionDefinitions([
			actionDefinition({
				options: [{ type: 'static-text', id: 'info', label: 'Info', value: 'hello' } as any],
			}),
		])

		const { actions } = lastPayloadFor(sendWithNoCb, 'setActionDefinitions')
		expect(actions['my-action'].options).toHaveLength(1)
		expect(actions['my-action'].options[0]).toMatchObject({ id: 'info', type: 'static-text' })
	})

	test('keys every action by its own id', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setActionDefinitions([
			actionDefinition({ id: 'a', name: 'A' }),
			actionDefinition({ id: 'b', name: 'B' }),
		])

		const { actions } = lastPayloadFor(sendWithNoCb, 'setActionDefinitions')
		expect(Object.keys(actions)).toEqual(['a', 'b'])
	})
})

describe('HostContext setFeedbackDefinitions', () => {
	function feedbackDefinition(overrides: Partial<HostFeedbackDefinition> = {}): HostFeedbackDefinition {
		return {
			id: 'my-feedback',
			name: 'My Feedback',
			sortName: undefined,
			description: 'A feedback',
			options: [],
			type: 'boolean',
			affectedProperties: undefined,
			hasLearn: false,
			showInvert: undefined,
			learnTimeout: undefined,
			...overrides,
		}
	}

	test('maps a boolean feedback into a client entity definition', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setFeedbackDefinitions([
			feedbackDefinition({ hasLearn: true, learnTimeout: 1000, defaultStyle: { color: 1 } }),
		])

		const { feedbacks } = lastPayloadFor(sendWithNoCb, 'setFeedbackDefinitions')
		expect(feedbacks['my-feedback']).toMatchObject({
			entityType: 'feedback',
			label: 'My Feedback',
			description: 'A feedback',
			sortKey: null,
			feedbackType: 'boolean',
			feedbackStyle: { color: 1 },
			hasLifecycleFunctions: true,
			hasLearn: true,
			learnTimeout: 1000,
			actionHasResult: undefined,
			optionsSupportExpressions: true,
		})
	})

	test('stringifies a numeric sortName', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setFeedbackDefinitions([feedbackDefinition({ sortName: 7 as unknown as string })])

		expect(lastPayloadFor(sendWithNoCb, 'setFeedbackDefinitions').feedbacks['my-feedback'].sortKey).toBe('7')
	})

	test('omits feedbacks with an unrecognised subtype', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setFeedbackDefinitions([
			feedbackDefinition({ id: 'good', type: 'advanced' }),
			feedbackDefinition({ id: 'bad', type: 'nonsense' as any }),
		])

		const { feedbacks } = lastPayloadFor(sendWithNoCb, 'setFeedbackDefinitions')
		expect(Object.keys(feedbacks)).toEqual(['good'])
	})

	describe('showInvert', () => {
		test('honours an explicit showInvert', () => {
			const { hostContext, sendWithNoCb } = createHostContext()

			hostContext.setFeedbackDefinitions([feedbackDefinition({ showInvert: false })])

			expect(lastPayloadFor(sendWithNoCb, 'setFeedbackDefinitions').feedbacks['my-feedback'].showInvert).toBe(false)
		})

		test('defaults to true when no invert-like option is present', () => {
			const { hostContext, sendWithNoCb } = createHostContext()

			hostContext.setFeedbackDefinitions([feedbackDefinition({ showInvert: undefined })])

			expect(lastPayloadFor(sendWithNoCb, 'setFeedbackDefinitions').feedbacks['my-feedback'].showInvert).toBe(true)
		})

		test.each(['invert', 'inverted'])('defaults to false when a "%s" checkbox option exists', (id) => {
			const { hostContext, sendWithNoCb } = createHostContext()

			hostContext.setFeedbackDefinitions([
				feedbackDefinition({ showInvert: undefined, options: [{ type: 'checkbox', id, label: id } as any] }),
			])

			expect(lastPayloadFor(sendWithNoCb, 'setFeedbackDefinitions').feedbacks['my-feedback'].showInvert).toBe(false)
		})
	})
})

describe('HostContext setVariableDefinitions', () => {
	test('maps definitions to name/description and passes the values through', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		const definitions: HostVariableDefinition[] = [
			{ id: 'my_var', name: 'My Variable' },
			{ id: 'other', name: 'Other' },
		]
		const values: HostVariableValue[] = [{ id: 'my_var', value: 'hello' }]

		hostContext.setVariableDefinitions(definitions, values)

		expect(lastPayloadFor(sendWithNoCb, 'setVariableDefinitions')).toEqual({
			variables: [
				{ name: 'my_var', description: 'My Variable' },
				{ name: 'other', description: 'Other' },
			],
			newValues: values,
		})
	})
})

describe('HostContext setCompositeElementDefinitions', () => {
	test('converts each element, cropping the implicit canvas, keyed by its id', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setCompositeElementDefinitions({
			widget: { name: 'Widget', description: 'A widget', options: [], elements: [] },
		} as any)

		const { definitions } = lastPayloadFor(sendWithNoCb, 'setCompositeElementDefinitions')
		expect(definitions).toEqual([{ id: 'widget', name: 'Widget', description: 'A widget', options: [], elements: [] }])
	})

	test('skips null entries', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setCompositeElementDefinitions({
			gone: null,
			kept: { name: 'Kept', description: undefined, options: [], elements: [] },
		} as any)

		const { definitions } = lastPayloadFor(sendWithNoCb, 'setCompositeElementDefinitions')
		expect(definitions.map((d: any) => d.id)).toEqual(['kept'])
	})
})

describe('HostContext setVariableValues', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	test('commits the first update immediately (leading edge)', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setVariableValues([{ id: 'a', value: 1 }])

		expect(payloadsFor(sendWithNoCb, 'setVariableValues')).toEqual([{ newValues: [{ id: 'a', value: 1 }] }])
	})

	test('coalesces a burst, keeping the latest value per id', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setVariableValues([{ id: 'a', value: 1 }]) // leading edge fires
		hostContext.setVariableValues([{ id: 'a', value: 2 }])
		hostContext.setVariableValues([{ id: 'b', value: 3 }])

		expect(payloadsFor(sendWithNoCb, 'setVariableValues')).toHaveLength(1)

		vi.advanceTimersByTime(50)

		expect(payloadsFor(sendWithNoCb, 'setVariableValues')).toEqual([
			{ newValues: [{ id: 'a', value: 1 }] },
			{
				newValues: [
					{ id: 'a', value: 2 },
					{ id: 'b', value: 3 },
				],
			},
		])
	})

	test('destroy cancels a pending flush', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setVariableValues([{ id: 'a', value: 1 }]) // leading edge fires
		hostContext.setVariableValues([{ id: 'a', value: 2 }]) // queued for the trailing edge

		hostContext.destroy()
		vi.advanceTimersByTime(100)

		expect(payloadsFor(sendWithNoCb, 'setVariableValues')).toHaveLength(1)
	})
})

describe('HostContext updateFeedbackValues', () => {
	function advancedValue(value: unknown): HostFeedbackValue {
		return { id: 'f1', controlId: 'ctl', feedbackType: 'advanced', value } as HostFeedbackValue
	}

	test('converts an advanced feedback Uint8Array imageBuffer to base64', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		const bytes = new Uint8Array([1, 2, 3, 4])
		hostContext.updateFeedbackValues([advancedValue({ imageBuffer: bytes, color: 5 })])

		const { values } = lastPayloadFor(sendWithNoCb, 'updateFeedbackValues')
		expect(values[0].value).toEqual({ imageBuffer: Buffer.from(bytes).toString('base64'), color: 5 })
	})

	test('leaves a non-Uint8Array imageBuffer untouched', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		const value = { imageBuffer: 'already-a-string' }
		hostContext.updateFeedbackValues([advancedValue(value)])

		expect(lastPayloadFor(sendWithNoCb, 'updateFeedbackValues').values[0].value).toBe(value)
	})

	test('passes advanced values with no imageBuffer through unchanged', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.updateFeedbackValues([advancedValue({ color: 1 })])

		expect(lastPayloadFor(sendWithNoCb, 'updateFeedbackValues').values[0].value).toEqual({ color: 1 })
	})

	test('passes a null advanced value through unchanged', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.updateFeedbackValues([advancedValue(null)])

		expect(lastPayloadFor(sendWithNoCb, 'updateFeedbackValues').values[0].value).toBeNull()
	})

	test('does not touch non-advanced feedback values', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		const value: HostFeedbackValue = { id: 'f1', controlId: 'ctl', feedbackType: 'boolean', value: true }
		hostContext.updateFeedbackValues([value])

		expect(lastPayloadFor(sendWithNoCb, 'updateFeedbackValues').values[0]).toEqual(value)
	})
})

describe('HostContext saveConfig', () => {
	test('forwards config and secrets', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.saveConfig({ a: 1 }, { b: 2 })

		expect(lastPayloadFor(sendWithNoCb, 'saveConfig')).toEqual({ config: { a: 1 }, secrets: { b: 2 } })
	})

	test('forwards undefined config and secrets', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.saveConfig(undefined, undefined)

		expect(lastPayloadFor(sendWithNoCb, 'saveConfig')).toEqual({ config: undefined, secrets: undefined })
	})
})

describe('HostContext sendOSC', () => {
	function sentArgs(sendWithNoCb: ReturnType<typeof vi.fn>) {
		return lastPayloadFor(sendWithNoCb, 'send-osc').args
	}

	test('sends the host, port and path', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.sendOSC('1.2.3.4', 9000, '/test', [])

		expect(lastPayloadFor(sendWithNoCb, 'send-osc')).toMatchObject({ host: '1.2.3.4', port: 9000, path: '/test' })
	})

	test('encodes a bare string as a string argument', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.sendOSC('h', 1, '/p', 'hello')

		expect(sentArgs(sendWithNoCb)).toEqual([{ type: 's', value: 'hello' }])
	})

	test('encodes a bare number as a float argument', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.sendOSC('h', 1, '/p', 12.5)

		expect(sentArgs(sendWithNoCb)).toEqual([{ type: 'f', value: 12.5 }])
	})

	test('encodes a Uint8Array as a base64 blob argument', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		const bytes = new Uint8Array([9, 8, 7])
		hostContext.sendOSC('h', 1, '/p', bytes)

		expect(sentArgs(sendWithNoCb)).toEqual([{ type: 'b', value: Buffer.from(bytes).toString('base64') }])
	})

	test('encodes a mixed array of arguments', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.sendOSC('h', 1, '/p', ['a', 2])

		expect(sentArgs(sendWithNoCb)).toEqual([
			{ type: 's', value: 'a' },
			{ type: 'f', value: 2 },
		])
	})

	test('passes through pre-encoded s/f/i object arguments', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.sendOSC('h', 1, '/p', [
			{ type: 's', value: 'x' },
			{ type: 'f', value: 1 },
			{ type: 'i', value: 3 },
		] as any)

		expect(sentArgs(sendWithNoCb)).toEqual([
			{ type: 's', value: 'x' },
			{ type: 'f', value: 1 },
			{ type: 'i', value: 3 },
		])
	})

	test('re-encodes a blob object argument with a Uint8Array value', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		const bytes = new Uint8Array([1, 2])
		hostContext.sendOSC('h', 1, '/p', [{ type: 'b', value: bytes }] as any)

		expect(sentArgs(sendWithNoCb)).toEqual([{ type: 'b', value: Buffer.from(bytes).toString('base64') }])
	})

	test('sends no arguments for null or undefined args', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.sendOSC('h', 1, '/p', null as any)
		expect(sentArgs(sendWithNoCb)).toEqual([])

		hostContext.sendOSC('h', 1, '/p', undefined as any)
		expect(sentArgs(sendWithNoCb)).toEqual([])
	})

	test('throws on an unsupported primitive argument', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		expect(() => hostContext.sendOSC('h', 1, '/p', true as any)).toThrow(/Unsupported OSC argument type/)
		expect(payloadsFor(sendWithNoCb, 'send-osc')).toHaveLength(0)
	})

	test('throws on an unsupported object argument', () => {
		const { hostContext } = createHostContext()

		expect(() => hostContext.sendOSC('h', 1, '/p', [{ type: 'x' }] as any)).toThrow(/Unsupported OSC argument type/)
	})

	test('throws on a blob object whose value is not a Uint8Array', () => {
		const { hostContext } = createHostContext()

		expect(() => hostContext.sendOSC('h', 1, '/p', [{ type: 'b', value: 'nope' }] as any)).toThrow(
			/Unsupported OSC argument type/
		)
	})
})

describe('HostContext recordAction', () => {
	test('forwards the action, defaulting a missing uniquenessId to null', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.recordAction({ actionId: 'do', options: { a: 1 }, delay: 500 }, undefined)

		expect(lastPayloadFor(sendWithNoCb, 'recordAction')).toEqual({
			uniquenessId: null,
			actionId: 'do',
			options: { a: 1 },
			delay: 500,
		})
	})

	test('forwards a provided uniquenessId', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.recordAction({ actionId: 'do', options: {}, delay: undefined }, 'uniq')

		expect(lastPayloadFor(sendWithNoCb, 'recordAction')).toMatchObject({ uniquenessId: 'uniq', actionId: 'do' })
	})
})

describe('HostContext setCustomVariable', () => {
	test('forwards the control, variable and value', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setCustomVariable('ctl', 'cvar', 'value')

		expect(lastPayloadFor(sendWithNoCb, 'setCustomVariable')).toEqual({
			controlId: 'ctl',
			customVariableId: 'cvar',
			value: 'value',
		})
	})

	test('forwards an undefined value', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setCustomVariable('ctl', 'cvar', undefined)

		expect(lastPayloadFor(sendWithNoCb, 'setCustomVariable').value).toBeUndefined()
	})
})

describe('HostContext shared UDP socket', () => {
	test('join sends the family and port and returns the handle', async () => {
		const { hostContext, sendWithCb } = createHostContext()
		sendWithCb.mockResolvedValue('handle-1')

		const handle = await hostContext.sharedUdpSocketJoin({ family: 'udp4', portNumber: 5000 } as any)

		expect(sendWithCb).toHaveBeenCalledWith('sharedUdpSocketJoin', { family: 'udp4', portNumber: 5000 })
		expect(handle).toBe('handle-1')
	})

	test('leave sends the handle id', async () => {
		const { hostContext, sendWithCb } = createHostContext()
		sendWithCb.mockResolvedValue(undefined)

		await hostContext.sharedUdpSocketLeave({ handleId: 'h1' })

		expect(sendWithCb).toHaveBeenCalledWith('sharedUdpSocketLeave', { handleId: 'h1' })
	})

	test('send base64-encodes the message and forwards the destination', async () => {
		const { hostContext, sendWithCb } = createHostContext()
		sendWithCb.mockResolvedValue(undefined)

		const message = Buffer.from('hello')
		await hostContext.sharedUdpSocketSend({ handleId: 'h1', message, address: '1.2.3.4', port: 9000 })

		expect(sendWithCb).toHaveBeenCalledWith('sharedUdpSocketSend', {
			handleId: 'h1',
			message: message.toString('base64'),
			address: '1.2.3.4',
			port: 9000,
		})
	})
})

// --- Preset definitions: the interplay between reported presets and feedback affectedProperties ---

function advancedFeedbackDefinition(affectedProperties: string[] | undefined): HostFeedbackDefinition {
	return {
		id: 'my-advanced',
		name: 'My Advanced',
		type: 'advanced',
		options: [],
		affectedProperties,
	} as unknown as HostFeedbackDefinition
}

const sections: CompanionPresetSection[] = [{ id: 'sec', name: 'Section', definitions: ['my-preset'] }]
const presets = {
	'my-preset': {
		type: 'simple',
		name: 'My Preset',
		style: { text: 'hello' },
		feedbacks: [{ feedbackId: 'my-advanced', options: {} }],
		steps: [],
	},
} as unknown as CompanionPresetDefinitions

/** The style properties the preset's advanced feedback was given overrides for */
function overriddenProperties(sendWithNoCb: ReturnType<typeof vi.fn>): string[] {
	const calls = sendWithNoCb.mock.calls.filter(([name]) => name === 'setPresetDefinitions')
	const lastPresets = calls[calls.length - 1][1].presets
	const feedback = lastPresets['my-preset'].model.feedbacks[0]
	return feedback.styleOverrides.map((override: any) => `${override.elementId}.${override.elementProperty}`)
}

describe('HostContext preset definitions', () => {
	test('advanced feedback overrides are limited by the declared affectedProperties', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setFeedbackDefinitions([advancedFeedbackDefinition(['imageBuffer'])])
		hostContext.setPresetDefinitions(sections, presets)

		expect(overriddenProperties(sendWithNoCb)).toEqual(['imageBuffers.base64Image'])
	})

	test('presets reported before the feedbacks are rebuilt once the feedbacks arrive', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		// A module is free to report its presets first, when nothing is yet known about its feedbacks
		hostContext.setPresetDefinitions(sections, presets)
		expect(overriddenProperties(sendWithNoCb).length).toBeGreaterThan(1)

		hostContext.setFeedbackDefinitions([advancedFeedbackDefinition(['imageBuffer'])])

		expect(overriddenProperties(sendWithNoCb)).toEqual(['imageBuffers.base64Image'])
	})

	test('an unchanged report of the feedback definitions does not re-report the presets', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setFeedbackDefinitions([advancedFeedbackDefinition(['imageBuffer'])])
		hostContext.setPresetDefinitions(sections, presets)

		sendWithNoCb.mockClear()
		hostContext.setFeedbackDefinitions([advancedFeedbackDefinition(['imageBuffer'])])

		expect(sendWithNoCb.mock.calls.filter(([name]) => name === 'setPresetDefinitions')).toHaveLength(0)
	})

	test('a change to the affectedProperties re-reports the presets', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setFeedbackDefinitions([advancedFeedbackDefinition(['imageBuffer'])])
		hostContext.setPresetDefinitions(sections, presets)

		sendWithNoCb.mockClear()
		hostContext.setFeedbackDefinitions([advancedFeedbackDefinition(['color'])])

		expect(sendWithNoCb.mock.calls.filter(([name]) => name === 'setPresetDefinitions')).toHaveLength(1)
	})

	test('the presets are not re-reported before the module has reported any', () => {
		const { hostContext, sendWithNoCb } = createHostContext()

		hostContext.setFeedbackDefinitions([advancedFeedbackDefinition(['imageBuffer'])])

		expect(sendWithNoCb.mock.calls.filter(([name]) => name === 'setPresetDefinitions')).toHaveLength(0)
	})
})
