import fs from 'node:fs'
import path from 'node:path'
import { CreatePageControlId } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import type { TestApp } from '../integration/TestApp.js'
import {
	addDemoConnection,
	addElement,
	addEntity,
	createButtonWithText,
	DEMO_MODULES,
	firstStepDown,
	prepareDocsApp,
	waitFor,
} from './Helpers.js'

/**
 * A small studio, which most of the screenshots of the user guide show: a vision mixer, an audio mixer and a media
 * player (the demo modules), and a page of buttons controlling them, built from the presets of the vision mixer.
 *
 * Page 1, "Studio":
 * - 0/1 to 0/4: put Camera 1-4 on program, red while on program. 0/1 is linked to its preset, the others are copies
 * - 1/1 CUT and 1/2 AUTO transitions, 1/3 the level of MIC 1, 1/4 the presenter (a page variable), 1/5 the tally of
 *   Camera 2, 1/6 put Camera 2 on preview
 * - 2/1 a reference to 0/2, 2/2 cycles Camera 3 and 4 on program with two steps, 2/3 MIC 4 with its level in red when
 *   too high (a value feedback), 2/4 red text while the custom variable `alarm` is true, 2/5 rolls a clip with a
 *   sequential action group, and 2/6 puts Camera 3 on air with an auto transition
 * - 3/1 the level of MIC 1, drawn with elements rather than the composite element, 3/2 an arrow kept square by its
 *   group, 3/3 the logo from the image library, 3/4 a reference element mirroring 0/1
 *
 * Page 2, "Audio": 0/1 plays a clip on the media player, which is failing to connect, 0/2 mutes a microphone on the
 * audio mixer, which is connecting, and 0/3 is running a long wait.
 *
 * Page 3, "Graphics", is empty. The image library has the Companion and Bitfocus logos.
 */
export const prepare = prepareDocsApp

/** Where the buttons of the studio are, on page 1 */
export const STUDIO = {
	cameras: [1, 2, 3, 4].map((camera) => ({ pageNumber: 1, row: 0, column: camera })),
	cut: { pageNumber: 1, row: 1, column: 1 },
	auto: { pageNumber: 1, row: 1, column: 2 },
	mic: { pageNumber: 1, row: 1, column: 3 },
	presenter: { pageNumber: 1, row: 1, column: 4 },
	tally: { pageNumber: 1, row: 1, column: 5 },
	preview: { pageNumber: 1, row: 1, column: 6 },
	reference: { pageNumber: 1, row: 2, column: 1 },
	steps: { pageNumber: 1, row: 2, column: 2 },
	level: { pageNumber: 1, row: 2, column: 3 },
	alarm: { pageNumber: 1, row: 2, column: 4 },
	rollClip: { pageNumber: 1, row: 2, column: 5 },
	camera3: { pageNumber: 1, row: 2, column: 6 },
	meter: { pageNumber: 1, row: 3, column: 1 },
	arrow: { pageNumber: 1, row: 3, column: 2 },
	logo: { pageNumber: 1, row: 3, column: 3 },
	referenceElement: { pageNumber: 1, row: 3, column: 4 },
	playClip: { pageNumber: 2, row: 0, column: 1 },
	mute: { pageNumber: 2, row: 0, column: 2 },
	running: { pageNumber: 2, row: 0, column: 3 },
} satisfies Record<string, ControlLocation | ControlLocation[]>

export async function seed(app: TestApp): Promise<void> {
	const mixer = await addDemoConnection(app, DEMO_MODULES.visionMixer, 'mixer', '2.6.0')
	const audio = await addDemoConnection(app, DEMO_MODULES.audioMixer, 'audio', '1.3.1')
	const playback = await addDemoConnection(app, DEMO_MODULES.mediaPlayer, 'playback', '3.0.2')
	await setConnectionConfig(app, audio, 'audio', { host: '192.168.0.20', port: 10023, simulate_status: 'connecting' })
	await setConnectionConfig(app, playback, 'playback', { host: '192.168.0.30', port: 9993, simulate_status: 'failure' })

	const repoRoot = path.join(import.meta.dirname, '../../..')
	for (const [name, description, file] of [
		['logo', 'The Companion logo', 'assets/linux/icon.png'],
		['bitfocus', 'The Bitfocus logo', 'launcher/assets/bitfocus-logo.png'],
	]) {
		await app.trpc().imageLibrary.create({ name, description })
		await app.registry.graphics.imageLibrary.setImageData(name, 'image/png', fs.readFileSync(path.join(repoRoot, file)))
	}

	await app.trpc().pages.setName({ pageNumber: 1, name: 'Studio' })
	for (const [index, name] of ['Audio', 'Graphics'].entries()) {
		await app.trpc().pages.insert({ asPageNumber: index + 2, pageNames: [name] })
	}

	const pageId = app.registry.page.store.getPageId(1)
	if (!pageId) throw new Error('Page 1 does not exist')
	app.addLocalVariable(CreatePageControlId(pageId), 'presenter', 'user_value', {
		startup_value: exprVal('Jane Smith'),
	})

	const importPreset = async (
		presetId: string,
		location: ControlLocation,
		variableValues: Record<string, number> | null,
		mode: 'copy' | 'reference'
	) => {
		const controlId = await app
			.trpc()
			.controls.importPreset({ connectionId: mixer, presetId, location, variableValues, mode })
		if (!controlId) throw new Error(`Failed to place the preset "${presetId}"`)
		return controlId
	}

	for (const [index, location] of STUDIO.cameras.entries()) {
		const controlId = await importPreset('program', location, { input: index + 1 }, index === 0 ? 'reference' : 'copy')
		if (index === 1) {
			await app.trpc().controls.setOptionsField({
				controlId,
				change: { controlType: 'button-layered', key: 'notes', value: 'Puts this camera on program. Red when live.' },
			})
		}
	}
	await importPreset('cut', STUDIO.cut, null, 'copy')
	await importPreset('auto', STUDIO.auto, null, 'copy')
	await importPreset('mic_1_meter', STUDIO.mic, null, 'copy')
	await createButtonWithText(app, STUDIO.presenter, '$(page:presenter)')
	await importPreset('tally_camera', STUDIO.tally, null, 'copy')
	await importPreset('preview', STUDIO.preview, { input: 2 }, 'copy')

	await app.trpc().controls.createReferenceControl({ fromLocation: STUDIO.cameras[1], toLocation: STUDIO.reference })

	const steps = await createButtonWithText(app, STUDIO.steps, 'Camera\\n$(mixer:program_input)')
	const step2 = await app.trpc().controls.steps.add({ controlId: steps })
	if (!step2) throw new Error('Failed to add a step')
	await addEntity(app, steps, firstStepDown(app, steps), null, mixer, EntityModelType.Action, 'program', {
		input: exprVal(3),
	})
	await addEntity(app, steps, { stepId: step2, setId: 'down' }, null, mixer, EntityModelType.Action, 'program', {
		input: exprVal(4),
	})

	const level = await createButtonWithText(app, STUDIO.level, 'MIC 4\\n$(mixer:mic_4_level) dB')
	const levelFeedback = await addEntity(app, level, 'feedbacks', null, mixer, EntityModelType.Feedback, 'audio_level', {
		mic: exprVal(4),
	})
	await app.trpc().controls.entities.replaceStyleOverride({
		controlId: level,
		entityLocation: 'feedbacks',
		entityId: levelFeedback,
		override: {
			overrideId: 'level',
			elementId: 'text0',
			elementProperty: 'color',
			override: exprExpr('$(this:value) > -6 ? 0xff4040 : 0xffffff'),
		},
	})

	app.createCustomVariable('alarm', true)
	const alarm = await createButtonWithText(app, STUDIO.alarm, 'Alarm')
	const alarmFeedback = app.addInternalFeedback(alarm, 'check_expression', { expression: exprVal('$(custom:alarm)') })
	await app.trpc().controls.entities.replaceStyleOverride({
		controlId: alarm,
		entityLocation: 'feedbacks',
		entityId: alarmFeedback,
		override: { overrideId: 'alarm', elementId: 'text0', elementProperty: 'color', override: exprVal(0xff0000) },
	})

	const rollClip = await createButtonWithText(app, STUDIO.rollClip, 'Roll clip')
	const group = app.addInternalAction(rollClip, 'action_group', { execution_mode: exprVal('sequential') })
	const groupActions = { parentId: group, childGroup: 'default' }
	const rollClipDown = firstStepDown(app, rollClip)
	await addEntity(app, rollClip, rollClipDown, groupActions, mixer, EntityModelType.Action, 'preview', {
		input: exprVal(6),
	})
	app.addInternalChildAction(rollClip, groupActions, 'wait', { time: exprVal(500) })
	await addEntity(app, rollClip, rollClipDown, groupActions, mixer, EntityModelType.Action, 'auto', {
		duration: exprVal(25),
	})

	const camera3 = await createButtonWithText(app, STUDIO.camera3, 'Camera 3\\nlive')
	const camera3Down = firstStepDown(app, camera3)
	await addEntity(app, camera3, camera3Down, null, mixer, EntityModelType.Action, 'preview', { input: exprVal(3) })
	await addEntity(app, camera3, camera3Down, null, mixer, EntityModelType.Action, 'auto', { duration: exprVal(25) })

	await createStylingButtons(app)

	const playClip = await createButtonWithText(app, STUDIO.playClip, 'Play clip')
	await addEntity(app, playClip, firstStepDown(app, playClip), null, playback, EntityModelType.Action, 'cut', {})
	const mute = await createButtonWithText(app, STUDIO.mute, 'Mute MIC 1')
	await addEntity(app, mute, firstStepDown(app, mute), null, audio, EntityModelType.Action, 'mic_mute', {
		mic: exprVal(1),
		mute: exprVal('toggle'),
	})
	const running = await createButtonWithText(app, STUDIO.running, 'Wait')
	app.addInternalAction(running, 'wait', { time: exprVal(24 * 60 * 60 * 1000) })
	app.pressButton(STUDIO.running, true)
	app.pressButton(STUDIO.running, false)

	// The buttons are drawn once their feedbacks have their values
	await waitFor(() => app.registry.variables.values.getVariableValue('mixer', 'program_input') === 1)
}

/** The buttons the button styling pages describe */
async function createStylingButtons(app: TestApp): Promise<void> {
	const meter = app.createButton(STUDIO.meter)
	await app.trpc().controls.styles.updateOptions({
		controlId: meter,
		elementId: 'box0',
		values: { color: exprVal(0x000000) },
	})
	await addElement(app, meter, 'box', 'Panel', null, {
		x: exprVal(5),
		y: exprVal(5),
		width: exprVal(90),
		height: exprVal(90),
		color: exprVal(0x1e2a38),
		cornerRadius: exprVal(10),
		borderWidth: exprVal(2),
		borderColor: exprVal(0x4a5a6a),
	})
	// A title of its own, above the panel, rather than the text the button starts with
	await app.trpc().controls.styles.removeElement({ controlId: meter, elementId: 'text0' })
	await addElement(app, meter, 'text', 'Title', null, {
		text: exprVal('MIC 1'),
		y: exprVal(8),
		height: exprVal(30),
		weight: exprVal('bold'),
	})
	await addElement(app, meter, 'text', 'Level', null, {
		text: exprExpr('`${$(mixer:mic_1_level)} dB`'),
		y: exprVal(36),
		height: exprVal(30),
		styles: exprVal(['italic']),
	})
	await addElement(app, meter, 'gauge', 'Meter', null, {
		x: exprVal(12),
		y: exprVal(72),
		width: exprVal(76),
		height: exprVal(12),
		value: exprExpr('$(mixer:mic_1_level)'),
		min: exprVal(-60),
		max: exprVal(10),
		multiColour: exprVal(true),
		stops: exprVal([
			{ value: -60, color: 0x00c000, gradient: true },
			{ value: -18, color: 0xd0d000, gradient: true },
			{ value: 0, color: 0xd00000, gradient: false },
		]),
	})

	const arrow = app.createButton(STUDIO.arrow)
	await app.trpc().controls.styles.removeElement({ controlId: arrow, elementId: 'text0' })
	const group = await addElement(app, arrow, 'group', 'Arrow', null, { squareCoords: exprVal(true) })
	await addElement(app, arrow, 'line', 'Shaft', group, {
		fromX: exprVal(20),
		fromY: exprVal(50),
		toX: exprVal(80),
		toY: exprVal(50),
		borderWidth: exprVal(8),
		borderColor: exprVal(0xffffff),
	})
	await addElement(app, arrow, 'line', 'Upper head', group, {
		fromX: exprVal(55),
		fromY: exprVal(25),
		toX: exprVal(80),
		toY: exprVal(50),
		borderWidth: exprVal(8),
		borderColor: exprVal(0xffffff),
	})
	await addElement(app, arrow, 'line', 'Lower head', group, {
		fromX: exprVal(55),
		fromY: exprVal(75),
		toX: exprVal(80),
		toY: exprVal(50),
		borderWidth: exprVal(8),
		borderColor: exprVal(0xffffff),
	})

	const logo = app.createButton(STUDIO.logo)
	await app.trpc().controls.styles.removeElement({ controlId: logo, elementId: 'text0' })
	await addElement(app, logo, 'image', 'Logo', null, {
		base64Image: exprVal('$(image:logo)'),
		x: exprVal(10),
		y: exprVal(10),
		width: exprVal(80),
		height: exprVal(80),
	})

	const reference = app.createButton(STUDIO.referenceElement)
	await app.trpc().controls.styles.removeElement({ controlId: reference, elementId: 'text0' })
	await addElement(app, reference, 'reference', 'Camera 1', null, { location: exprExpr('`${$(this:page)}/0/1`') })
}

/** Change the config of a connection */
async function setConnectionConfig(
	app: TestApp,
	connectionId: string,
	label: string,
	config: Record<string, string | number>
): Promise<void> {
	const error = await app.trpc().instances.connections.setConfig({ connectionId, label, config })
	if (error) throw new Error(`Failed to configure "${label}": ${error}`)
}
