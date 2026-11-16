import { CUSTOM_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import { ParseControlId } from '@companion-app/shared/ControlId.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import type { TestApp } from '../integration/TestApp.js'
import { addElement, createButtonWithText, prepareDocsApp, waitFor } from './Helpers.js'

/**
 * The examples of the custom actions, custom feedbacks and custom elements pages of the user guide
 * (docs/user-guide/3_config/program/building-blocks/custom-actions.md, custom-feedbacks.md and custom-elements.md), for
 * their screenshots.
 *
 * - "Select camera" sets `selected_camera` to its `camera` input, and `selected_from` to where it was called from
 * - "Ramp value" counts its `level` up to `target` in a loop, a `step` at a time, with `level` as an output
 * - "Camera is selected" is true while `selected_camera` is its `camera` input
 * - Buttons 1/0/0 to 1/0/3 (CAM 1-4) call "Select camera" and use "Camera is selected", each with its own camera
 * - Buttons 1/1/0 and 1/1/1 (Ramp A/B) call "Ramp value", storing its output in `fader_a` and `fader_b`. They
 *   ramp slowly, so that their runs are still in progress while a screenshot is taken
 * - "Channel label" is a custom element drawing its `name` input over a bar of its `color` input
 * - Buttons 1/2/0 to 1/2/2 (CH 1-3) each use "Channel label" along their bottom, with their own name and colour
 *
 * The http api is enabled, for the screenshots to press buttons and set variables.
 */
export const prepare = prepareDocsApp

export async function seed(app: TestApp): Promise<void> {
	// The screenshots press the buttons and set the variables through the http api
	app.registry.userconfig.setKey('http_api_enabled', true)

	app.createCustomVariable('selected_camera', 1)
	app.createCustomVariable('selected_from', '')
	app.createCustomVariable('fader_a', 0)
	app.createCustomVariable('fader_b', 0)

	const select = await app.trpc().controls.customActions.create({ name: 'Select camera' })
	await app.trpc().controls.setOptionsField({
		controlId: select,
		change: { controlType: 'custom-action', key: 'description', value: 'Remember which camera is selected' },
	})
	await app.trpc().controls.buildingBlockInputs.add({
		controlId: select,
		field: { type: 'number', id: 'camera', label: 'Camera', default: 1, min: 1, max: 8 },
	})
	app.addCustomActionAction(select, null, 'custom_variable_set_value', {
		name: exprVal('selected_camera'),
		create: exprVal(false),
		value: exprExpr('$(options:camera)'),
	})
	app.addCustomActionAction(select, null, 'custom_variable_set_value', {
		name: exprVal('selected_from'),
		create: exprVal(false),
		value: exprExpr('$(this:location)'),
	})

	const ramp = await app.trpc().controls.customActions.create({ name: 'Ramp value' })
	await app.trpc().controls.setOptionsField({
		controlId: ramp,
		change: { controlType: 'custom-action', key: 'description', value: 'Count up to a target, a step at a time' },
	})
	await app.trpc().controls.buildingBlockInputs.add({
		controlId: ramp,
		field: { type: 'number', id: 'target', label: 'Target', default: 100, min: 0, max: 1000 },
	})
	await app.trpc().controls.buildingBlockInputs.add({
		controlId: ramp,
		field: { type: 'number', id: 'step', label: 'Step', default: 10, min: 1, max: 1000 },
	})
	await app.trpc().controls.buildingBlockInputs.add({
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

	const selected = await app.trpc().controls.customFeedbacks.create({ name: 'Camera is selected' })
	await app.trpc().controls.setOptionsField({
		controlId: selected,
		change: { controlType: 'custom-feedback', key: 'description', value: 'True while a camera is the selected one' },
	})
	await app.trpc().controls.buildingBlockInputs.add({
		controlId: selected,
		field: { type: 'number', id: 'camera', label: 'Camera', default: 1, min: 1, max: 8 },
	})
	app.addInternalFeedback(selected, 'check_expression', {
		expression: exprVal('$(custom:selected_camera) == $(options:camera)'),
	})
	const selectedId = ParseControlId(selected)
	if (selectedId?.type !== 'custom-feedback') throw new Error(`"${selected}" is not a custom feedback`)
	// It is offered as a feedback once the change to it has been processed
	await waitFor(() =>
		app.registry.instance.definitions.getEntityDefinition(
			EntityModelType.Feedback,
			CUSTOM_CONNECTION_ID,
			selectedId.customFeedbackId
		)
	)

	for (let camera = 1; camera <= 4; camera++) {
		const buttonId = await createButtonWithText(app, { pageNumber: 1, row: 0, column: camera - 1 }, `CAM ${camera}`)
		app.addCustomActionCall(buttonId, select, { camera: exprVal(camera) }, null)

		const feedbackId = await app.trpc().controls.entities.add({
			controlId: buttonId,
			entityLocation: 'feedbacks',
			ownerId: null,
			connectionId: CUSTOM_CONNECTION_ID,
			entityType: EntityModelType.Feedback,
			entityDefinition: selectedId.customFeedbackId,
		})
		if (!feedbackId) throw new Error(`Failed to add "Camera is selected" to ${buttonId}`)
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
			override: { overrideId: 'selected', elementId: 'box0', elementProperty: 'color', override: exprVal(0xcc0000) },
		})
	}

	const rampA = await createButtonWithText(app, { pageNumber: 1, row: 1, column: 0 }, 'Ramp A\\n$(custom:fader_a)')
	app.addCustomActionCall(
		rampA,
		ramp,
		{ target: exprVal(100), step: exprVal(5), delay: exprVal(1000) },
		{ level: { type: 'custom-variable', variableName: exprVal('fader_a'), createIfNotExists: false } }
	)
	const rampB = await createButtonWithText(app, { pageNumber: 1, row: 1, column: 1 }, 'Ramp B\\n$(custom:fader_b)')
	app.addCustomActionCall(
		rampB,
		ramp,
		{ target: exprVal(50), step: exprVal(10), delay: exprVal(4000) },
		{ level: { type: 'custom-variable', variableName: exprVal('fader_b'), createIfNotExists: false } }
	)

	await seedCustomElements(app)
}

/** "Channel label", and the buttons which use it */
async function seedCustomElements(app: TestApp): Promise<void> {
	const label = await app.trpc().controls.customElements.create({ name: 'Channel label' })
	await app.trpc().controls.setOptionsField({
		controlId: label,
		change: { controlType: 'custom-element', key: 'description', value: "A channel's name over a coloured bar" },
	})
	await app.trpc().controls.buildingBlockInputs.add({
		controlId: label,
		field: { type: 'textinput', id: 'name', label: 'Name', default: 'CH' },
	})
	await app.trpc().controls.buildingBlockInputs.add({
		controlId: label,
		field: { type: 'colorpicker', id: 'color', label: 'Color', default: '#cc0000', enableAlpha: false },
	})
	await addElement(app, label, 'box', 'Bar', null, {
		color: exprExpr('$(options:color)'),
		cornerRadius: exprVal(15),
	})
	await addElement(app, label, 'text', 'Label text', null, {
		text: exprExpr('$(options:name)'),
		color: exprVal(0xffffff),
	})

	const labelId = ParseControlId(label)
	if (labelId?.type !== 'custom-element') throw new Error(`"${label}" is not a custom element`)
	// It is offered as an element once the change to it has been processed
	await waitFor(() =>
		app.registry.instance.definitions.getCompositeElementDefinition(CUSTOM_CONNECTION_ID, labelId.customElementId)
	)

	const channels = [
		{ name: 'Vocals', color: '#cc0000' },
		{ name: 'Guitar', color: '#1f5fbf' },
		{ name: 'Keys', color: '#2e8b3a' },
	]
	for (const [index, channel] of channels.entries()) {
		const buttonId = await createButtonWithText(app, { pageNumber: 1, row: 2, column: index }, `CH ${index + 1}`)
		await app.trpc().controls.styles.updateOptions({
			controlId: buttonId,
			elementId: 'text0',
			values: { height: exprVal(55) },
		})
		await addElement(app, buttonId, `${CUSTOM_CONNECTION_ID};${labelId.customElementId}`, 'Channel label', null, {
			x: exprVal(5),
			y: exprVal(60),
			width: exprVal(90),
			height: exprVal(35),
			'opt:name': exprVal(channel.name),
			'opt:color': exprVal(channel.color),
		})
	}
}
