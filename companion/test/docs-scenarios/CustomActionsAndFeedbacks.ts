import { CUSTOM_FEEDBACKS_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import { ParseControlId, type BankControlId } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import type { TestApp } from '../integration/TestApp.js'

/**
 * The examples of the custom actions and custom feedbacks pages of the user guide
 * (docs/user-guide/3_config/custom-actions.md and custom-feedbacks.md), for their screenshots.
 *
 * - "Cut to camera" sets `program` to its `camera` input, and `last_cut_from` to where it was called from
 * - "Ramp value" counts its `level` up to `target` in a loop, a `step` at a time, with `level` as an output
 * - "Camera is live" is true while `program` is its `camera` input
 * - Buttons 1/0/0 to 1/0/3 (CAM 1-4) call "Cut to camera" and use "Camera is live", each with its own camera
 * - Buttons 1/1/0 and 1/1/1 (Ramp A/B) call "Ramp value", storing its output in `fader_a` and `fader_b`. They
 *   ramp slowly, so that their runs are still in progress while a screenshot is taken
 *
 * The http api is enabled, for the screenshots to press buttons and set variables.
 */
export async function seed(app: TestApp): Promise<void> {
	// The screenshots press the buttons and set the variables through the http api
	app.registry.userconfig.setKey('http_api_enabled', true)

	app.createCustomVariable('program', 1)
	app.createCustomVariable('last_cut_from', '')
	app.createCustomVariable('fader_a', 0)
	app.createCustomVariable('fader_b', 0)

	const cut = await app.trpc().controls.customActions.create({ name: 'Cut to camera' })
	await app.trpc().controls.setOptionsField({
		controlId: cut,
		change: { controlType: 'custom-action', key: 'description', value: 'Put a camera on program' },
	})
	await app.trpc().controls.customActions.inputAdd({
		controlId: cut,
		field: { type: 'number', id: 'camera', label: 'Camera', default: 1, min: 1, max: 8 },
	})
	app.addCustomActionAction(cut, null, 'custom_variable_set_value', {
		name: exprVal('program'),
		create: exprVal(false),
		value: exprExpr('$(options:camera)'),
	})
	app.addCustomActionAction(cut, null, 'custom_variable_set_value', {
		name: exprVal('last_cut_from'),
		create: exprVal(false),
		value: exprExpr('$(this:location)'),
	})

	const ramp = await app.trpc().controls.customActions.create({ name: 'Ramp value' })
	await app.trpc().controls.setOptionsField({
		controlId: ramp,
		change: { controlType: 'custom-action', key: 'description', value: 'Count up to a target, a step at a time' },
	})
	await app.trpc().controls.customActions.inputAdd({
		controlId: ramp,
		field: { type: 'number', id: 'target', label: 'Target', default: 100, min: 0, max: 1000 },
	})
	await app.trpc().controls.customActions.inputAdd({
		controlId: ramp,
		field: { type: 'number', id: 'step', label: 'Step', default: 10, min: 1, max: 1000 },
	})
	await app.trpc().controls.customActions.inputAdd({
		controlId: ramp,
		field: { type: 'number', id: 'delay', label: 'Delay (ms)', default: 100, min: 0, max: 10000 },
	})
	app.addLocalVariable(ramp, 'level', 'user_value', { startup_value: exprVal(0) })
	const loopId = app.addCustomActionAction(ramp, null, 'logic_while', {})
	app.addCustomActionChildFeedback(ramp, { parentId: loopId, childGroup: 'condition' }, 'check_expression', {
		expression: exprVal('$(local:level) < $(options:target)'),
	})
	const loopBody = { parentId: loopId, childGroup: 'actions' }
	app.addCustomActionAction(ramp, loopBody, 'local_variable_set_value', {
		location: exprVal('run'),
		name: exprVal('level'),
		value: exprExpr(
			'$(local:level) + $(options:step) > $(options:target) ? $(options:target) : $(local:level) + $(options:step)'
		),
	})
	app.addCustomActionAction(ramp, loopBody, 'wait', { time: exprExpr('$(options:delay)') })
	await app.trpc().controls.customActions.outputSet({ controlId: ramp, variableName: 'level', label: 'Level' })

	const live = await app.trpc().controls.customFeedbacks.create({ name: 'Camera is live' })
	await app.trpc().controls.setOptionsField({
		controlId: live,
		change: { controlType: 'custom-feedback', key: 'description', value: 'True while a camera is on program' },
	})
	await app.trpc().controls.customFeedbacks.inputAdd({
		controlId: live,
		field: { type: 'number', id: 'camera', label: 'Camera', default: 1, min: 1, max: 8 },
	})
	app.addInternalFeedback(live, 'check_expression', {
		expression: exprVal('$(custom:program) == $(options:camera)'),
	})
	const liveId = ParseControlId(live)
	if (liveId?.type !== 'custom-feedback') throw new Error(`"${live}" is not a custom feedback`)
	// It is offered as a feedback once the change to it has been processed
	await waitFor(() =>
		app.registry.instance.definitions.getEntityDefinition(
			EntityModelType.Feedback,
			CUSTOM_FEEDBACKS_CONNECTION_ID,
			liveId.customFeedbackId
		)
	)

	for (let camera = 1; camera <= 4; camera++) {
		const buttonId = await createButtonWithText(app, { pageNumber: 1, row: 0, column: camera - 1 }, `CAM ${camera}`)
		app.addCustomActionCall(buttonId, cut, { camera: exprVal(camera) }, null)

		const feedbackId = await app.trpc().controls.entities.add({
			controlId: buttonId,
			entityLocation: 'feedbacks',
			ownerId: null,
			connectionId: CUSTOM_FEEDBACKS_CONNECTION_ID,
			entityType: EntityModelType.Feedback,
			entityDefinition: liveId.customFeedbackId,
		})
		if (!feedbackId) throw new Error(`Failed to add "Camera is live" to ${buttonId}`)
		await app.trpc().controls.entities.setOption({
			controlId: buttonId,
			entityLocation: 'feedbacks',
			entityId: feedbackId,
			key: 'camera',
			value: exprVal(camera),
		})
		await app.trpc().controls.entities.replaceStyleOverride({
			controlId: buttonId,
			entityLocation: 'feedbacks',
			entityId: feedbackId,
			override: { overrideId: 'live', elementId: 'box0', elementProperty: 'color', override: exprVal(0xcc0000) },
		})
	}

	const rampA = await createButtonWithText(app, { pageNumber: 1, row: 1, column: 0 }, 'Ramp A\\n$(custom:fader_a)')
	app.addCustomActionCall(
		rampA,
		ramp,
		{ target: exprVal(100), step: exprVal(5), delay: exprVal(500) },
		{ level: { type: 'custom-variable', variableName: exprVal('fader_a'), createIfNotExists: false } }
	)
	const rampB = await createButtonWithText(app, { pageNumber: 1, row: 1, column: 1 }, 'Ramp B\\n$(custom:fader_b)')
	app.addCustomActionCall(
		rampB,
		ramp,
		{ target: exprVal(50), step: exprVal(10), delay: exprVal(1000) },
		{ level: { type: 'custom-variable', variableName: exprVal('fader_b'), createIfNotExists: false } }
	)
}

async function createButtonWithText(app: TestApp, location: ControlLocation, text: string): Promise<BankControlId> {
	const controlId = app.createButton(location)
	await app.trpc().controls.styles.updateOption({ controlId, elementId: 'text0', key: 'text', value: exprVal(text) })
	return controlId
}

async function waitFor(check: () => unknown): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt++) {
		if (check()) return
		await new Promise((resolve) => setTimeout(resolve, 50))
	}
	throw new Error('Timed out waiting for the app')
}
