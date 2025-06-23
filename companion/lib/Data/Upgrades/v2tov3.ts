import { CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import { nanoid } from 'nanoid'
import { LEGACY_MAX_BUTTONS, LEGACY_PAGE_COUNT } from '../../Resources/Constants.js'
import type { DataStoreBase, DataStoreTableView } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'

function convertInstanceToV3(obj: any): any {
	if (obj.config === undefined) {
		const newConfig = { ...obj }
		delete newConfig.instance_type
		delete newConfig.label
		delete newConfig.enabled
		delete newConfig._configIdx

		return {
			instance_type: obj.instance_type,
			label: obj.label,
			enabled: obj.enabled,
			config: newConfig,
			lastUpgradeIndex: obj._configIdx,
		}
	} else {
		return obj
	}
}

function convertInstancesToV3(mainTable: DataStoreTableView<any>) {
	const instances = mainTable.get('instance')
	if (instances) {
		// Delete the old internal module, as it is truly internal now
		delete instances['bitfocus-companion']

		let i = 0
		for (const [id, obj] of Object.entries(instances)) {
			instances[id] = convertInstanceToV3(obj)
			if (typeof instances[id].sortOrder !== 'number') instances[id].sortOrder = i++
		}

		mainTable.set('instance', instances)
	}
}

function CreateBankControlIdOld(page: number, bank: number): string {
	return `bank:${page}-${bank}`
}

function convertToControls(mainTable: DataStoreTableView<any>): void {
	if (!mainTable.get('controls')) {
		const oldBankConfig = mainTable.get('bank') ?? {}
		const oldActions = mainTable.get('bank_actions') ?? {}
		const oldReleaseActions = mainTable.get('bank_release_actions') ?? {}
		const oldRotateLeftActions = mainTable.get('bank_rotate_left_actions') ?? {}
		const oldRotateRightActions = mainTable.get('bank_rotate_right_actions') ?? {}
		const oldDeviceonfig = mainTable.get('deviceconfig') ?? {}

		const newSteps: any = {}

		for (let page = 1; page <= LEGACY_PAGE_COUNT; page++) {
			const obj = {
				config: oldBankConfig[page],
				actions: oldActions[page],
				release_actions: oldReleaseActions[page],
				rotate_left_actions: oldRotateLeftActions[page],
				rotate_right_actions: oldRotateRightActions[page],
			}

			const res = convertPageToV3(obj)

			oldBankConfig[page] = res.config
			newSteps[page] = res.steps
		}

		// Update the db
		mainTable.delete('bank_actions')
		mainTable.delete('bank_release_actions')

		const oldConfig = mainTable.get('bank') ?? {}
		const oldFeedbacks = mainTable.get('feedbacks') ?? {}

		const newControls: any = {}
		for (let page = 1; page <= LEGACY_PAGE_COUNT; page++) {
			for (let bank = 1; bank <= LEGACY_MAX_BUTTONS; bank++) {
				const bankConfig = oldConfig[page]?.[bank]
				if (bankConfig && bankConfig.style) {
					const bankSteps = newSteps[page]?.[bank]
					const bankFeedbacks = oldFeedbacks[page]?.[bank]

					newControls[CreateBankControlIdOld(page, bank)] = fixUpControl({
						...splitBankConfigToStyleAndOptions(bankConfig),
						steps: bankSteps || {},
						feedbacks: bankFeedbacks || [],
					})
				}
			}
		}

		if (oldDeviceonfig['emulator']) {
			oldDeviceonfig['emulator:emulator'] = oldDeviceonfig['emulator']
			oldDeviceonfig['emulator'] = undefined
		}

		mainTable.delete('bank')
		mainTable.delete('feedbacks')
		mainTable.delete('bank_action_sets')
		mainTable.delete('bank_rotate_left_actions')
		mainTable.delete('bank_rotate_right_actions')
		mainTable.set('controls', newControls)
		mainTable.set('deviceconfig', oldDeviceonfig)

		mainTable.set('page_config_version', 3)
	}

	// patch v3 pre https://github.com/bitfocus/companion/pull/2187
	const controls = mainTable.get('controls')
	if (controls) {
		for (const control of Object.values(controls)) {
			if (control) {
				fixUpControl(control)
			}
		}
		mainTable.set('controls', controls)
	}
}

function convertTriggerToControl(logger: Logger, entry: any, index: number): any {
	const actions: any[] = []
	const control: any = {
		type: 'trigger',
		options: {
			name: 'New Trigger',
			enabled: false,
			sortOrder: 0,
			relativeDelay: false,
		},
		action_sets: { 0: actions },
		condition: [],
		events: [],
	}

	control.options.name = entry.title
	control.options.enabled = !entry.disabled
	control.options.sortOrder = index

	// Copy across actions
	if (Array.isArray(entry.actions)) {
		for (const action of entry.actions) {
			// Fix up instance ids for the internal
			if (action.instance === 'bitfocus-companion') {
				action.instance = 'internal'
			}
			actions.push(action)
		}
	}

	switch (entry.type) {
		case 'tod':
			control.events.push({
				id: nanoid(),
				type: 'timeofday',
				enabled: true,
				options: {
					time: entry.config.time,
					days: entry.config.days,
				},
			})
			break
		case 'interval':
			control.events.push({
				id: nanoid(),
				type: 'interval',
				enabled: true,
				options: {
					seconds: Number(entry.config.seconds),
				},
			})
			break
		case 'instance':
			switch (entry.config.run) {
				case 'start':
					control.events.push({
						id: nanoid(),
						type: 'startup',
						enabled: true,
						options: {
							delay: 10000,
						},
					})
					break
				case 'io_connect':
					control.events.push({
						id: nanoid(),
						type: 'client_connect',
						enabled: true,
						options: {
							delay: 0,
						},
					})
					break
				case 'button_press':
					control.events.push({
						id: nanoid(),
						type: 'button_press',
						enabled: true,
						options: {},
					})
					break
				case 'button_depress':
					control.events.push({
						id: nanoid(),
						type: 'button_depress',
						enabled: true,
						options: {},
					})
					break
				default:
					logger.warn(`Unable to upgrade trigger of unknown type: ${entry.config.run}`)
					control.events.push({
						id: nanoid(),
						type: entry.config.run,
						enabled: false,
						options: {},
					})
					break
			}
			break
		case 'feedback': {
			control.events.push({
				id: nanoid(),
				type: 'condition_true',
				enabled: true,
				options: {},
			})

			const config = Array.isArray(entry.config) ? entry.config : [entry.config]
			for (const feedback of config) {
				if (feedback.instance_id === 'bitfocus-companion') {
					feedback.instance_id = 'internal'
				}

				control.condition.push(feedback)
			}

			break
		}
		case 'variable': {
			// Convert old variable type to new format
			control.events.push({
				id: nanoid(),
				type: 'condition_true',
				enabled: true,
				options: {},
			})

			const oldConfig = Array.isArray(entry.config) ? entry.config : [entry.config]
			for (const conf of oldConfig) {
				// the operators were inverted..
				let check = conf.check
				if (check == 'lt') check = 'gt'
				else if (check == 'gt') check = 'lt'

				// push the condition
				control.condition.push({
					id: nanoid(),
					type: 'variable_value',
					instance_id: 'internal',
					options: {
						variable: conf.key,
						op: check,
						value: conf.value,
					},
				})
			}

			break
		}
		default:
			logger.warn(`Unable to upgrade trigger of unknown type: ${entry.type}`)
			control.events.push({
				id: nanoid(),
				type: entry.type,
				enabled: false,
				options: {},
			})
			break
	}

	// Convert button index to an action
	if (entry.button && !entry.actions) {
		const page = parseInt(entry.button)
		const bank = parseInt(entry.button.toString().replace(/(.*)\./, ''))
		actions.push([
			{
				id: nanoid(),
				instance: 'internal',
				action: 'button_pressrelease',
				options: {
					page: page,
					bank: bank,
				},
			},
		])
	}

	return control
}

function convertSchedulerToControls(mainTable: DataStoreTableView<any>, logger: Logger) {
	let scheduler = mainTable.get('scheduler')
	if (scheduler) {
		const controls = mainTable.get('controls') ?? {}

		if (Array.isArray(scheduler)) {
			// Convert into an object
			const obj: any = {}
			for (const conf of scheduler) {
				obj[conf.id] = conf
			}
			scheduler = obj
		}

		Object.entries(scheduler).forEach(([id, entry], index) => {
			if (entry) {
				controls[CreateTriggerControlId(id)] = convertTriggerToControl(logger, entry, index)
			}
		})

		mainTable.set('controls', controls)
		mainTable.delete('scheduler')
	}
}

function convertEmulatorToV3(mainTable: DataStoreTableView<any>): void {
	const userconfig = mainTable.get('userconfig')
	if (userconfig) {
		const instances = mainTable.get('deviceconfig')
		if (instances['emulator'] && instances['emulator'].config) {
			instances['emulator'].config.emulator_control_enable = userconfig.emulator_control_enable ?? false
			instances['emulator'].config.emulator_prompt_fullscreen = userconfig.emulator_prompt_fullscreen ?? false
		}

		if (instances['emulator'] && !instances['emulator:emulator']) {
			instances['emulator:emulator'] = instances['emulator']
			instances['emulator:emulator'].integrationType = 'emulator'
			delete instances['emulator']
		}

		mainTable.set('deviceconfig', instances)
	}
}

function convertSurfacesToV3(mainTable: DataStoreTableView<any>) {
	const devices = mainTable.get('deviceconfig')
	if (!devices) return

	// Ignore satellite for now, as that has not been updated, and no colon
	const keys = Object.keys(devices).filter((d) => !d.startsWith('satellite-') && d.indexOf(':') === -1)

	for (const key of keys) {
		const key2 = key.trim()
		if (key2.length === 12) {
			// add prefix to known streamdeck
			devices[`streamdeck:${key2}`] = devices[key]
			delete devices[key]
		} else if (key2.length === 27) {
			// add prefix to known loupedeck
			devices[`loupedeck:${key2}`] = devices[key]
			delete devices[key]
		}
	}

	mainTable.set('deviceconfig', devices)
}

/**
 * do the database upgrades to convert from the v2 to the v3 format
 */
function convertDatabaseToV3(db: DataStoreBase<any>, logger: Logger): void {
	const mainTable = db.defaultTableView

	convertInstancesToV3(mainTable)

	convertToControls(mainTable)

	convertSchedulerToControls(mainTable, logger)

	convertEmulatorToV3(mainTable)
	convertSurfacesToV3(mainTable)
}

function convertPageToV3(oldObj: any) {
	// find the old data
	const oldPageConfig = oldObj.config || {}
	const oldPageActions = oldObj.actions || {}
	const oldPageReleaseActions = oldObj.release_actions || {}
	const oldPageRotateLeftActions = oldObj.rotate_left_actions || {}
	const oldPageRotateRightActions = oldObj.rotate_right_actions || {}

	// create the new data
	const result: any = {
		config: {},
		steps: {},
	}

	// convert the data across
	for (let bank = 1; bank <= LEGACY_MAX_BUTTONS; ++bank) {
		const config = oldPageConfig[bank] || {}

		if (config && config.style == 'png') {
			config.style = 'button'
		}

		result.config[bank] = config

		result.steps[bank] = combineActionsToStepsAndSets(
			config,
			oldPageActions[bank],
			oldPageReleaseActions[bank],
			oldPageRotateLeftActions[bank],
			oldPageRotateRightActions[bank]
		)
	}

	return result
}

function fixUpControl(control: any) {
	if (control.type === 'press') {
		control.type = 'button'

		if (!control.steps) {
			control.steps = {
				0: {
					action_sets: control.action_sets,
				},
			}

			control.options.stepAutoProgress = true
		}

		delete control.action_sets
	} else if (control.type === 'step') {
		control.type = 'button'

		if (!control.steps) {
			control.steps = {}

			const keys = Object.keys(control.action_sets || {}).sort()

			for (const key of keys) {
				control.steps[key] = {
					action_sets: {
						down: control.action_sets[key],
						up: [],
					},
				}
			}
		}

		delete control.action_sets
	}

	for (const step of Object.values<any>(control.steps || {})) {
		for (const set of Object.values<any>(step.action_sets)) {
			for (const action of set) {
				if (action.instance === 'bitfocus-companion') {
					action.instance = 'internal'
				}
			}
		}
	}

	for (const feedback of control.feedbacks || []) {
		if (feedback.instance_id === 'bitfocus-companion') {
			feedback.instance_id = 'internal'
		}
	}

	return control
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function convertImportToSets(obj: any, logger: Logger) {
	if (obj.type == 'full') {
		const newObj: any = {
			version: 3,
			orig_version: obj.orig_version || obj.version,
			type: 'full',
			instances: {},
			controls: {},
			pages: obj.page,
			custom_variables: obj.custom_variables,
		}

		for (const [id, inst] of Object.entries(obj.instances)) {
			newObj.instances[id] = convertInstanceToV3(inst)
		}
		delete newObj.instances['bitfocus-companion']

		for (let page = 1; page <= LEGACY_PAGE_COUNT; page++) {
			for (let bank = 1; bank <= LEGACY_MAX_BUTTONS; bank++) {
				const config = obj.config[page]?.[bank]
				if (config?.style) {
					newObj.controls[CreateBankControlIdOld(page, bank)] = fixUpControl({
						...splitBankConfigToStyleAndOptions(config),
						steps: combineActionsToStepsAndSets(
							config,
							obj.actions?.[page]?.[bank],
							obj.release_actions?.[page]?.[bank],
							obj.rotate_left_actions?.[page]?.[bank],
							obj.rotate_right_actions?.[page]?.[bank]
						),
						feedbacks: obj.feedbacks?.[page]?.[bank] || [],
					})
				}
			}
		}

		if (obj.triggers) {
			newObj.triggers = obj.triggers.map((trigger: any, index: number) =>
				convertTriggerToControl(logger, trigger, index)
			)
		}

		return newObj
	} else {
		// type == 'page'
		const newObj: any = {
			version: 3,
			orig_version: obj.orig_version || obj.version,
			type: 'page',
			instances: {},
			controls: {},
			page: obj.page,
			oldPageNumber: 1,
		}

		for (const [id, inst] of Object.entries(obj.instances)) {
			newObj.instances[id] = convertInstanceToV3(inst)
		}
		delete newObj.instances['bitfocus-companion']

		for (let bank = 1; bank <= LEGACY_MAX_BUTTONS; bank++) {
			const config = obj.config?.[bank]
			if (config?.style) {
				newObj.controls[CreateBankControlIdOld(newObj.oldPageNumber, bank)] = fixUpControl({
					...splitBankConfigToStyleAndOptions(config),
					steps: combineActionsToStepsAndSets(
						config,
						obj.actions?.[bank],
						obj.release_actions?.[bank],
						obj.rotate_left_actions?.[bank],
						obj.rotate_right_actions?.[bank]
					),
					feedbacks: obj.feedbacks?.[bank] || [],
				})
			}
		}

		return newObj
	}
}

function splitBankConfigToStyleAndOptions(config: any) {
	const type = config.style === 'png' ? 'button' : config.style

	const style = {
		...config,
		show_topbar: config.show_topbar ?? config.show_top_bar ?? 'default',
	}
	delete style.relative_delay
	delete style.show_top_bar
	delete style.style
	delete style.rotary_actions

	const options = {
		relativeDelay: config.relative_delay,
		rotaryActions: !!config.rotary_actions,
		stepAutoProgress: true,
	}

	return { style, options, type }
}

function combineActionsToStepsAndSets(
	style: any,
	actions: any[],
	release_actions: any[],
	rotate_left_actions: any[],
	rotate_right_actions: any[]
) {
	const bank_action_steps: any = {}
	if (style.latch) {
		bank_action_steps['0'] = {
			action_sets: {
				down: actions || [],
				up: [],
			},
		}
		bank_action_steps['1'] = {
			action_sets: {
				down: release_actions || [],
				up: [],
			},
		}

		if (style.rotary_actions) {
			// TODO - clone and fix ids onto step 1 too
			bank_action_steps['0'].action_sets['rotate_left'] = rotate_left_actions || []
			bank_action_steps['0'].action_sets['rotate_right'] = rotate_right_actions || []
		}
	} else {
		bank_action_steps['0'] = {
			action_sets: {
				down: actions || [],
				up: release_actions || [],
			},
		}

		if (style.rotary_actions) {
			bank_action_steps['0'].action_sets['rotate_left'] = rotate_left_actions || []
			bank_action_steps['0'].action_sets['rotate_right'] = rotate_right_actions || []
		}
	}
	return bank_action_steps
}

export default {
	upgradeStartup: convertDatabaseToV3,
	upgradeImport: convertImportToSets,
}
