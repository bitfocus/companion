import { initTRPC } from '@trpc/server'
import { describe, expect, test } from 'vitest'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { VariablesInstanceDefinitions } from '../../lib/Variables/InstanceDefinitions.js'
import { createMockTrpcContext } from '../Util.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

const t = initTRPC.context<TrpcContext>().create()
const testCtx: TrpcContext = createMockTrpcContext()

function createDefinitions() {
	const definitions = new VariablesInstanceDefinitions()
	const caller = t.createCallerFactory(definitions.createTrpcRouter())(testCtx)
	return { definitions, caller }
}

describe('VariablesInstanceDefinitions', () => {
	test('set and get definitions for a connection', () => {
		const { definitions } = createDefinitions()

		definitions.setVariableDefinitions('conn1', [
			{ name: 'var_a', description: 'First' },
			{ name: 'var_b', description: 'Second' },
		])

		expect(definitions.getVariableDefinitions('conn1')).toEqual({
			var_a: { name: 'var_a', description: 'First' },
			var_b: { name: 'var_b', description: 'Second' },
		})
		expect(definitions.getVariableDescription('conn1', 'var_a')).toBe('First')
		expect(definitions.getVariableDescription('conn1', 'unknown')).toBe(undefined)
		expect(definitions.getVariableDescription('unknown', 'var_a')).toBe(undefined)
		expect(definitions.getVariableDefinitions('unknown')).toEqual({})
	})

	test('extra properties on definitions are pruned', () => {
		const { definitions } = createDefinitions()

		definitions.setVariableDefinitions('conn1', [{ name: 'var_a', description: 'First', somethingElse: true } as any])

		expect(definitions.getVariableDefinitions('conn1')).toEqual({
			var_a: { name: 'var_a', description: 'First' },
		})
	})

	test('reserved variable names are dropped', () => {
		const { definitions } = createDefinitions()

		definitions.setVariableDefinitions('conn1', [
			{ name: '__proto__', description: 'evil' },
			{ name: 'constructor', description: 'evil' },
			{ name: 'ok', description: 'fine' },
		])

		expect(Object.keys(definitions.getVariableDefinitions('conn1'))).toEqual(['ok'])
	})

	test('forgetConnection removes the definitions', () => {
		const { definitions } = createDefinitions()
		definitions.setVariableDefinitions('conn1', [{ name: 'var_a', description: 'First' }])

		definitions.forgetConnection('id1', 'conn1')

		expect(definitions.getVariableDefinitions('conn1')).toEqual({})
	})

	test('connectionLabelRename moves the definitions', () => {
		const { definitions } = createDefinitions()
		definitions.setVariableDefinitions('conn1', [{ name: 'var_a', description: 'First' }])

		definitions.connectionLabelRename('conn1', 'conn2')

		expect(definitions.getVariableDefinitions('conn1')).toEqual({})
		expect(definitions.getVariableDefinitions('conn2')).toEqual({
			var_a: { name: 'var_a', description: 'First' },
		})
	})

	test('connectionLabelRename of an unknown label is a no-op', () => {
		const { definitions } = createDefinitions()

		definitions.connectionLabelRename('unknown', 'conn2')

		expect(definitions.getVariableDefinitions('conn2')).toEqual({})
	})

	describe('watch subscription', () => {
		test('yields init, then set for a new connection', async () => {
			const { definitions, caller } = createDefinitions()
			definitions.setVariableDefinitions('existing', [{ name: 'var_a', description: 'First' }])

			const subscription = new SubscriptionTester(await caller.watch())
			await subscription.expectValue({
				type: 'init',
				variables: { existing: { var_a: { name: 'var_a', description: 'First' } } },
			})

			definitions.setVariableDefinitions('conn1', [{ name: 'var_b', description: 'Second' }])
			await subscription.expectValue({
				type: 'set',
				label: 'conn1',
				variables: { var_b: { name: 'var_b', description: 'Second' } },
			})

			await subscription.cleanup()
		})

		test('yields a patch when existing definitions change', async () => {
			const { definitions, caller } = createDefinitions()
			definitions.setVariableDefinitions('conn1', [
				{ name: 'var_a', description: 'First' },
				{ name: 'var_b', description: 'Second' },
			])

			const subscription = new SubscriptionTester(await caller.watch())
			await subscription.next() // init

			definitions.setVariableDefinitions('conn1', [
				{ name: 'var_a', description: 'Updated' },
				{ name: 'var_c', description: 'Third' },
			])

			const patch = (await subscription.next()) as any
			expect(patch.type).toBe('patch')
			expect(patch.label).toBe('conn1')

			await subscription.cleanup()
		})

		test('an unchanged set does not emit', async () => {
			const { definitions, caller } = createDefinitions()
			definitions.setVariableDefinitions('conn1', [{ name: 'var_a', description: 'First' }])

			const subscription = new SubscriptionTester(await caller.watch())
			await subscription.next() // init

			// Set the same definitions again, then make a real change
			definitions.setVariableDefinitions('conn1', [{ name: 'var_a', description: 'First' }])
			definitions.forgetConnection('id1', 'conn1')

			// The next event is the remove, not a patch for the unchanged set
			await subscription.expectValue({ type: 'remove', label: 'conn1' })

			await subscription.cleanup()
		})

		test('rename yields set of the new label and remove of the old', async () => {
			const { definitions, caller } = createDefinitions()
			definitions.setVariableDefinitions('conn1', [{ name: 'var_a', description: 'First' }])

			const subscription = new SubscriptionTester(await caller.watch())
			await subscription.next() // init

			definitions.connectionLabelRename('conn1', 'conn2')
			await subscription.expectValue({
				type: 'set',
				label: 'conn2',
				variables: { var_a: { name: 'var_a', description: 'First' } },
			})
			await subscription.expectValue({ type: 'remove', label: 'conn1' })

			await subscription.cleanup()
		})
	})
})
