import { describe, expect, it } from 'vitest'
import {
	exprExpr,
	exprVal,
	type ExpressionableOptionsObject,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { visitInputFieldReferences } from '../../../lib/Resources/Visitors/InputFieldVisitor.js'
import { VisitorReferencesCollectorVisitor } from '../../../lib/Resources/Visitors/ReferencesCollector.js'
import { VisitorReferencesUpdaterVisitor } from '../../../lib/Resources/Visitors/ReferencesUpdater.js'

// ─── Helpers ────────────────────────────────────────────────────────────────

function connectionField(id: string, extra: { multiple: boolean; includeAll?: boolean }): SomeCompanionInputField {
	return { type: 'internal:connection_id', id, label: id, ...extra }
}

function variableField(id: string): SomeCompanionInputField {
	return { type: 'internal:variable', id, label: id, supportsLocal: false }
}

function outboundSurfaceField(id: string): SomeCompanionInputField {
	return { type: 'internal:outbound_surface_id', id, label: id }
}

function makeCollector() {
	return new VisitorReferencesCollectorVisitor(undefined, undefined, undefined, undefined)
}

function makeUpdater(opts: {
	labelRemap?: Record<string, string>
	idRemap?: Record<string, string>
	outboundSurfaceIdRemap?: Record<string, string>
}) {
	return new VisitorReferencesUpdaterVisitor(opts.labelRemap, opts.idRemap, opts.outboundSurfaceIdRemap)
}

// ─── internal:connection_id ─────────────────────────────────────────────────

describe('visitInputFieldReferences – internal:connection_id', () => {
	it('remaps a single connection id', () => {
		const updater = makeUpdater({ idRemap: { old: 'new' } })
		const options: ExpressionableOptionsObject = { conn: exprVal('old') }

		visitInputFieldReferences(updater, [connectionField('conn', { multiple: false })], options, undefined)

		expect(options.conn).toEqual(exprVal('new'))
	})

	it('remaps every id of a multiple field', () => {
		const updater = makeUpdater({ idRemap: { a: 'a2', b: 'b2' } })
		const options: ExpressionableOptionsObject = { conns: exprVal(['a', 'b', 'c']) }

		visitInputFieldReferences(updater, [connectionField('conns', { multiple: true })], options, undefined)

		expect(options.conns).toEqual(exprVal(['a2', 'b2', 'c']))
	})

	it('collects the ids of a multiple field', () => {
		const collector = makeCollector()

		visitInputFieldReferences(
			collector,
			[connectionField('conns', { multiple: true })],
			{ conns: exprVal(['a', 'b']) },
			undefined
		)

		expect(collector.connectionIds).toEqual(new Set(['a', 'b']))
	})

	it("skips 'all' when the field allows it", () => {
		const collector = makeCollector()

		visitInputFieldReferences(
			collector,
			[connectionField('conn', { multiple: false, includeAll: true })],
			{ conn: exprVal('all') },
			undefined
		)

		expect(collector.connectionIds.size).toBe(0)
	})

	it("visits a real id when the field allows 'all'", () => {
		const collector = makeCollector()

		visitInputFieldReferences(
			collector,
			[connectionField('conn', { multiple: false, includeAll: true })],
			{ conn: exprVal('conn-1') },
			undefined
		)

		expect(collector.connectionIds).toEqual(new Set(['conn-1']))
	})

	it("treats 'all' as an id when the field does not allow it", () => {
		const collector = makeCollector()

		visitInputFieldReferences(
			collector,
			[connectionField('conn', { multiple: false })],
			{ conn: exprVal('all') },
			undefined
		)

		expect(collector.connectionIds).toEqual(new Set(['all']))
	})

	it('leaves an expression alone', () => {
		const updater = makeUpdater({ idRemap: { old: 'new' } })
		const options: ExpressionableOptionsObject = { conn: exprExpr('old') }

		visitInputFieldReferences(updater, [connectionField('conn', { multiple: false })], options, undefined)

		expect(options.conn).toEqual(exprExpr('old'))
		expect(updater.changed).toBe(false)
	})

	it('handles a missing value', () => {
		const collector = makeCollector()

		visitInputFieldReferences(
			collector,
			[connectionField('conn', { multiple: false, includeAll: true })],
			{},
			undefined
		)

		expect(collector.connectionIds.size).toBe(0)
	})
})

// ─── internal:variable ──────────────────────────────────────────────────────

describe('visitInputFieldReferences – internal:variable', () => {
	it('remaps the connection label of a variable name', () => {
		const updater = makeUpdater({ labelRemap: { old: 'new' } })
		const options: ExpressionableOptionsObject = { variable: exprVal('old:thing') }

		visitInputFieldReferences(updater, [variableField('variable')], options, undefined)

		expect(options.variable).toEqual(exprVal('new:thing'))
	})

	it('collects the variable', () => {
		const collector = makeCollector()

		visitInputFieldReferences(collector, [variableField('variable')], { variable: exprVal('a:b') }, undefined)

		expect(collector.variables).toEqual(new Set(['a:b']))
		expect(collector.connectionLabels).toEqual(new Set(['a']))
	})
})

// ─── internal:outbound_surface_id ───────────────────────────────────────────

describe('visitInputFieldReferences – internal:outbound_surface_id', () => {
	it('remaps the surface id', () => {
		const updater = makeUpdater({ outboundSurfaceIdRemap: { old: 'new' } })
		const options: ExpressionableOptionsObject = { surfaceId: exprVal('old') }

		visitInputFieldReferences(updater, [outboundSurfaceField('surfaceId')], options, undefined)

		expect(options.surfaceId).toEqual(exprVal('new'))
	})

	it('collects the surface id', () => {
		const collector = makeCollector()

		visitInputFieldReferences(collector, [outboundSurfaceField('surfaceId')], { surfaceId: exprVal('s1') }, undefined)

		expect(collector.outboundSurfaceIds).toEqual(new Set(['s1']))
	})
})

// ─── Other fields ───────────────────────────────────────────────────────────

describe('visitInputFieldReferences – other fields', () => {
	it('does not treat other field types as references', () => {
		const collector = makeCollector()
		const fields: SomeCompanionInputField[] = [
			{ type: 'textinput', id: 'text', label: 'Text' },
			{ type: 'internal:custom_variable', id: 'custom', label: 'Custom' },
			{ type: 'internal:page', id: 'page', label: 'Page', includeStartup: false, includeDirection: false },
			{ type: 'internal:trigger', id: 'trigger', label: 'Trigger' },
		] as SomeCompanionInputField[]

		visitInputFieldReferences(
			collector,
			fields,
			{
				text: exprVal('a:b'),
				custom: exprVal('a:b'),
				page: exprVal('conn-1'),
				trigger: exprVal('conn-1'),
			},
			undefined
		)

		expect(collector.connectionIds.size).toBe(0)
		expect(collector.variables.size).toBe(0)
	})

	it('visits each reference field of a definition', () => {
		const collector = makeCollector()

		visitInputFieldReferences(
			collector,
			[connectionField('conn', { multiple: false }), variableField('v1'), variableField('v2')],
			{ conn: exprVal('conn-1'), v1: exprVal('a:one'), v2: exprVal('b:two') },
			undefined
		)

		expect(collector.connectionIds).toEqual(new Set(['conn-1']))
		expect(collector.variables).toEqual(new Set(['a:one', 'b:two']))
	})
})

// ─── Feedback ids ───────────────────────────────────────────────────────────

describe('visitInputFieldReferences – feedback id', () => {
	it('records the feedback id for each kind of reference it changes', () => {
		const updater = makeUpdater({
			idRemap: { old: 'new' },
			labelRemap: { oldl: 'newl' },
			outboundSurfaceIdRemap: { olds: 'news' },
		})

		visitInputFieldReferences(updater, [connectionField('conn', { multiple: false })], { conn: exprVal('old') }, 'f1')
		visitInputFieldReferences(
			updater,
			[connectionField('conns', { multiple: true })],
			{ conns: exprVal(['old']) },
			'f2'
		)
		visitInputFieldReferences(updater, [variableField('variable')], { variable: exprVal('oldl:x') }, 'f3')
		visitInputFieldReferences(updater, [outboundSurfaceField('surfaceId')], { surfaceId: exprVal('olds') }, 'f4')

		expect(updater.changedFeedbackIds).toEqual(new Set(['f1', 'f2', 'f3', 'f4']))
	})

	it('records nothing for an action', () => {
		const updater = makeUpdater({ idRemap: { old: 'new' } })

		visitInputFieldReferences(
			updater,
			[connectionField('conn', { multiple: false })],
			{ conn: exprVal('old') },
			undefined
		)

		expect(updater.changed).toBe(true)
		expect(updater.changedFeedbackIds.size).toBe(0)
	})
})
