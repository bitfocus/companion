/*
 * The connection module the screenshots of the docs use, standing in for the control of a real device: a vision mixer
 * with its inputs, transitions and the levels of its microphones, with actions, feedbacks, variables, presets and
 * composite elements like those of a real module. It doesn't connect to anything, and its state only changes when its
 * actions are run, so that the screenshots are the same each time.
 *
 * The same source is bundled as each of the demo modules (see DemoModules.ts), which differ in what they are named.
 */
import { InstanceBase, InstanceStatus } from '@companion-module/base'

const INPUTS = [
	{ id: 1, label: 'Camera 1' },
	{ id: 2, label: 'Camera 2' },
	{ id: 3, label: 'Camera 3' },
	{ id: 4, label: 'Camera 4' },
	{ id: 5, label: 'Graphics' },
	{ id: 6, label: 'Playback' },
	{ id: 7, label: 'Colour Bars' },
	{ id: 8, label: 'Black' },
]
const INPUT_CHOICES = INPUTS.map((input) => ({ id: input.id, label: input.label }))

const MICS = [
	{ id: 1, label: 'MIC 1', level: -12 },
	{ id: 2, label: 'MIC 2', level: -18 },
	{ id: 3, label: 'MIC 3', level: -42 },
	{ id: 4, label: 'MIC 4', level: -3 },
]
const MIC_CHOICES = MICS.map((mic) => ({ id: mic.id, label: mic.label }))

const RED = 0xcc0000
const GREEN = 0x00a000
const WHITE = 0xffffff
const BLACK = 0x000000

function expr(value) {
	return { isExpression: true, value }
}

class DemoInstance extends InstanceBase {
	async init(config) {
		this.config = config
		this.program = 1
		this.preview = 2
		this.mics = Object.fromEntries(MICS.map((mic) => [mic.id, { level: mic.level, muted: false }]))

		this.updateStatusFromConfig()
		this.setActionDefinitions(this.actions())
		this.setFeedbackDefinitions(this.feedbacks())
		this.setVariableDefinitions(this.variables())
		this.setCompositeElementDefinitions(this.compositeElements())
		this.setPresetDefinitions(...this.presets())
		this.updateVariables()
	}

	async destroy() {}

	async configUpdated(config) {
		this.config = config
		this.updateStatusFromConfig()
	}

	/** It doesn't connect to anything, so it reports the status it is configured to */
	updateStatusFromConfig() {
		switch (this.config.simulate_status) {
			case 'warning':
				this.updateStatus(InstanceStatus.UnknownWarning, `${this.config.host} is running old firmware`)
				break
			case 'failure':
				this.updateStatus(InstanceStatus.ConnectionFailure, `Unable to reach ${this.config.host}`)
				break
			default:
				this.updateStatus(InstanceStatus.Ok)
				break
		}
	}

	getConfigFields() {
		return [
			{ type: 'textinput', id: 'host', label: 'Target IP', width: 8, default: '192.168.0.10' },
			{ type: 'number', id: 'port', label: 'Port', width: 4, default: 9910, min: 1, max: 65535 },
			{
				type: 'dropdown',
				id: 'simulate_status',
				label: 'Simulated status',
				width: 6,
				tooltip: 'This is a demo, which pretends to connect',
				choices: [
					{ id: 'ok', label: 'Connected' },
					{ id: 'warning', label: 'Old firmware' },
					{ id: 'failure', label: 'Connection failure' },
				],
				default: 'ok',
			},
		]
	}

	actions() {
		return {
			program: {
				name: 'Set program input',
				description: 'Put an input on program',
				options: [{ type: 'dropdown', id: 'input', label: 'Input', choices: INPUT_CHOICES, default: 1 }],
				callback: (action) => this.setProgram(Number(action.options.input)),
				learn: () => ({ input: this.program }),
			},
			preview: {
				name: 'Set preview input',
				description: 'Put an input on preview, ready for the next transition',
				options: [{ type: 'dropdown', id: 'input', label: 'Input', choices: INPUT_CHOICES, default: 1 }],
				callback: (action) => {
					this.preview = Number(action.options.input)
					this.update()
				},
				learn: () => ({ input: this.preview }),
			},
			cut: {
				name: 'Cut',
				description: 'Swap the inputs on program and preview',
				options: [],
				callback: () => this.transition(),
			},
			auto: {
				name: 'Auto transition',
				description: 'Mix from program to preview',
				options: [{ type: 'number', id: 'duration', label: 'Duration (frames)', default: 25, min: 1, max: 250 }],
				callback: () => this.transition(),
			},
			mic_mute: {
				name: 'Microphone: Mute',
				options: [
					{ type: 'dropdown', id: 'mic', label: 'Microphone', choices: MIC_CHOICES, default: 1 },
					{
						type: 'dropdown',
						id: 'mute',
						label: 'Mute',
						choices: [
							{ id: 'toggle', label: 'Toggle' },
							{ id: 'on', label: 'On' },
							{ id: 'off', label: 'Off' },
						],
						default: 'toggle',
					},
				],
				callback: (action) => {
					const mic = this.mics[Number(action.options.mic)]
					if (!mic) return
					mic.muted = action.options.mute === 'toggle' ? !mic.muted : action.options.mute === 'on'
					this.update()
				},
			},
		}
	}

	feedbacks() {
		return {
			program: {
				type: 'boolean',
				name: 'Input is on program',
				description: 'Red while an input is on program',
				defaultStyle: { bgcolor: RED, color: WHITE },
				options: [{ type: 'dropdown', id: 'input', label: 'Input', choices: INPUT_CHOICES, default: 1 }],
				callback: (feedback) => Number(feedback.options.input) === this.program,
				learn: () => ({ input: this.program }),
			},
			preview: {
				type: 'boolean',
				name: 'Input is on preview',
				description: 'Green while an input is on preview',
				defaultStyle: { bgcolor: GREEN, color: WHITE },
				options: [{ type: 'dropdown', id: 'input', label: 'Input', choices: INPUT_CHOICES, default: 1 }],
				callback: (feedback) => Number(feedback.options.input) === this.preview,
				learn: () => ({ input: this.preview }),
			},
			mic_muted: {
				type: 'boolean',
				name: 'Microphone is muted',
				defaultStyle: { bgcolor: RED, color: WHITE },
				options: [{ type: 'dropdown', id: 'mic', label: 'Microphone', choices: MIC_CHOICES, default: 1 }],
				callback: (feedback) => !!this.mics[Number(feedback.options.mic)]?.muted,
			},
			audio_level: {
				type: 'value',
				name: 'Audio level (dB)',
				description: 'The level of a microphone, in dB',
				options: [{ type: 'dropdown', id: 'mic', label: 'Microphone', choices: MIC_CHOICES, default: 1 }],
				callback: (feedback) => this.mics[Number(feedback.options.mic)]?.level ?? -60,
			},
		}
	}

	variables() {
		return {
			program_input: { name: 'Input on program' },
			program_input_name: { name: 'Name of the input on program' },
			preview_input: { name: 'Input on preview' },
			preview_input_name: { name: 'Name of the input on preview' },
			...Object.fromEntries(INPUTS.map((input) => [`input_${input.id}_name`, { name: `Name of input ${input.id}` }])),
			...Object.fromEntries(MICS.map((mic) => [`mic_${mic.id}_level`, { name: `Level of ${mic.label} (dB)` }])),
			...Object.fromEntries(MICS.map((mic) => [`mic_${mic.id}_muted`, { name: `Whether ${mic.label} is muted` }])),
		}
	}

	compositeElements() {
		return {
			level_meter: {
				type: 'composite',
				name: 'Level meter',
				description: 'The name and level of an audio source, with a meter',
				options: [
					{ type: 'textinput', id: 'name', label: 'Name', default: 'MIC 1', useVariables: true },
					{ type: 'textinput', id: 'level', label: 'Level (dB)', default: '-12', useVariables: true },
				],
				elements: [
					{
						type: 'box',
						id: 'panel',
						name: 'Panel',
						x: 5,
						y: 5,
						width: 90,
						height: 90,
						color: 0x1e2a38,
						cornerRadius: 10,
						borderWidth: 2,
						borderColor: 0x4a5a6a,
					},
					{ type: 'text', id: 'name', name: 'Name', x: 5, y: 10, width: 90, height: 30, text: expr('$(options:name)') },
					{
						type: 'text',
						id: 'level',
						name: 'Level',
						x: 5,
						y: 38,
						width: 90,
						height: 30,
						text: expr('`${$(options:level)} dB`'),
						styles: ['italic'],
					},
					{
						type: 'gauge',
						id: 'meter',
						name: 'Meter',
						x: 12,
						y: 72,
						width: 76,
						height: 12,
						value: expr('$(options:level)'),
						min: -60,
						max: 10,
						multiColour: true,
						stops: [
							{ value: -60, color: 0x00c000, gradient: true },
							{ value: -18, color: 0xd0d000, gradient: true },
							{ value: 0, color: 0xd00000, gradient: false },
						],
					},
				],
			},
			tally_label: {
				type: 'composite',
				name: 'Tally label',
				description: 'A label, coloured red while on program and green while on preview',
				options: [
					{ type: 'textinput', id: 'text', label: 'Text', default: 'CAM 1', useVariables: true },
					{
						type: 'dropdown',
						id: 'tally',
						label: 'Tally',
						choices: [
							{ id: 'off', label: 'Off' },
							{ id: 'preview', label: 'Preview' },
							{ id: 'program', label: 'Program' },
						],
						default: 'off',
					},
				],
				elements: [
					{
						type: 'box',
						id: 'background',
						name: 'Background',
						x: 0,
						y: 70,
						width: 100,
						height: 30,
						color: expr(`$(options:tally) == 'program' ? ${RED} : $(options:tally) == 'preview' ? ${GREEN} : 0x333333`),
					},
					{
						type: 'text',
						id: 'text',
						name: 'Text',
						x: 0,
						y: 70,
						width: 100,
						height: 30,
						text: expr('$(options:text)'),
					},
				],
			},
		}
	}

	presets() {
		const label = this.label
		const inputPreset = (bus, name) => ({
			type: 'simple',
			name: `${name} input`,
			style: { text: `$(${label}:input_$(local:input)_name)`, size: 'auto', color: WHITE, bgcolor: BLACK },
			localVariables: [{ variableType: 'simple', variableName: 'input', startupValue: 1 }],
			steps: [{ down: [{ actionId: bus, options: { input: expr('$(local:input)') } }], up: [] }],
			feedbacks: [
				{
					feedbackId: bus,
					options: { input: expr('$(local:input)') },
					style: bus === 'program' ? { bgcolor: RED, color: WHITE } : { bgcolor: GREEN, color: WHITE },
				},
			],
		})
		const inputValues = INPUTS.map((input) => ({ name: input.label, value: input.id }))

		const presets = {
			program: inputPreset('program', 'Program'),
			preview: inputPreset('preview', 'Preview'),
			cut: {
				type: 'simple',
				name: 'Cut',
				style: { text: 'CUT', size: '18', color: WHITE, bgcolor: BLACK },
				steps: [{ down: [{ actionId: 'cut', options: {} }], up: [] }],
				feedbacks: [],
			},
			auto: {
				type: 'simple',
				name: 'Auto transition',
				style: { text: 'AUTO', size: '18', color: WHITE, bgcolor: BLACK },
				steps: [{ down: [{ actionId: 'auto', options: { duration: 25 } }], up: [] }],
				feedbacks: [],
			},
			...Object.fromEntries(
				MICS.map((mic) => [
					`mic_${mic.id}_meter`,
					{
						type: 'layered',
						name: `${mic.label} level`,
						elements: [
							{
								type: 'composite',
								elementId: 'level_meter',
								name: 'Meter',
								options: { name: mic.label, level: `$(${label}:mic_${mic.id}_level)` },
							},
						],
						steps: [{ down: [{ actionId: 'mic_mute', options: { mic: mic.id, mute: 'toggle' } }], up: [] }],
						feedbacks: [],
					},
				])
			),
			tally_camera: {
				type: 'layered',
				name: 'Camera with tally',
				elements: [
					{ type: 'box', id: 'background', name: 'Background', color: BLACK },
					{ type: 'text', id: 'text', name: 'Text', text: 'Camera', y: 0, height: 70 },
					{
						type: 'composite',
						elementId: 'tally_label',
						name: 'Tally',
						options: {
							text: 'CAM 2',
							tally: expr(
								`$(${label}:program_input) == 2 ? 'program' : $(${label}:preview_input) == 2 ? 'preview' : 'off'`
							),
						},
					},
				],
				steps: [{ down: [{ actionId: 'preview', options: { input: 2 } }], up: [] }],
				feedbacks: [],
			},
		}

		const structure = [
			{
				id: 'inputs',
				name: 'Inputs',
				definitions: [
					{
						id: 'program',
						type: 'template',
						name: 'Program inputs',
						presetId: 'program',
						templateVariableName: 'input',
						templateValues: inputValues,
					},
					{
						id: 'preview',
						type: 'template',
						name: 'Preview inputs',
						presetId: 'preview',
						templateVariableName: 'input',
						templateValues: inputValues,
					},
				],
			},
			{ id: 'transitions', name: 'Transitions', definitions: ['cut', 'auto'] },
			{
				id: 'showcase',
				name: 'Showcase',
				description: 'Buttons drawn with the composite elements of this module',
				definitions: [...MICS.map((mic) => `mic_${mic.id}_meter`), 'tally_camera'],
			},
		]

		return [structure, presets]
	}

	setProgram(input) {
		if (input === this.preview) this.preview = this.program
		this.program = input
		this.update()
	}

	transition() {
		const program = this.program
		this.program = this.preview
		this.preview = program
		this.update()
	}

	update() {
		this.updateVariables()
		this.checkAllFeedbacks()
	}

	updateVariables() {
		const inputName = (id) => INPUTS.find((input) => input.id === id)?.label ?? ''
		this.setVariableValues({
			program_input: this.program,
			program_input_name: inputName(this.program),
			preview_input: this.preview,
			preview_input_name: inputName(this.preview),
			...Object.fromEntries(INPUTS.map((input) => [`input_${input.id}_name`, input.label])),
			...Object.fromEntries(MICS.map((mic) => [`mic_${mic.id}_level`, this.mics[mic.id].level])),
			...Object.fromEntries(MICS.map((mic) => [`mic_${mic.id}_muted`, this.mics[mic.id].muted])),
		})
	}
}

export default DemoInstance
export const UpgradeScripts = []
