import ControlTrigger from '../../Controls/ControlTypes/Triggers/Trigger.js'
import { CreateTriggerControlId } from '../../Shared/ControlId.js'
import { cloneDeep } from 'lodash-es'
import { nanoid } from 'nanoid'
import { LEGACY_MAX_BUTTONS, LEGACY_PAGE_COUNT } from '../../Util/Constants.js'

/**
 *
 * @param {*} obj
 * @returns
 */
function convertInstanceToV3(obj) {
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

/**
 *
 * @param {*} db
 */
function convertInstancesToV3(db) {
	if (db.hasKey('instance')) {
		const instances = db.getKey('instance')
		// Delete the old internal module, as it is truly internal now
		delete instances['bitfocus-companion']

		let i = 0
		for (const [id, obj] of Object.entries(instances)) {
			instances[id] = convertInstanceToV3(obj)
			if (typeof instances[id].sortOrder !== 'number') instances[id].sortOrder = i++
		}

		db.setKey('instance', instances)
	}
}

/**
 *
 * @param {number} page
 * @param {number} bank
 * @returns {string}
 */
function CreateBankControlIdOld(page, bank) {
	return `bank:${page}-${bank}`
}

/**
 *
 * @param {*} db
 */
function convertToControls(db) {
	if (!db.hasKey('controls')) {
		const oldBankConfig = db.getKey('bank', {})
		const oldActions = db.getKey('bank_actions', {})
		const oldReleaseActions = db.getKey('bank_release_actions', {})
		const oldRotateLeftActions = db.getKey('bank_rotate_left_actions', {})
		const oldRotateRightActions = db.getKey('bank_rotate_right_actions', {})

		/** @type {any} */
		const newSteps = {}

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
		db.deleteKey('bank_actions')
		db.deleteKey('bank_release_actions')

		const oldConfig = db.getKey('bank', {})
		const oldFeedbacks = db.getKey('feedbacks', {})

		/** @type {any} */
		const newControls = {}
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

		db.deleteKey('bank')
		db.deleteKey('feedbacks')
		db.deleteKey('bank_action_sets')
		db.setKey('controls', newControls)
	}

	// patch v3 pre https://github.com/bitfocus/companion/pull/2187
	const controls = db.getKey('controls')
	if (controls) {
		for (const control of Object.values(controls)) {
			if (control) {
				fixUpControl(control)
			}
		}
	}
}

/**
 * @param {import('winston').Logger} logger
 * @param {*} entry
 * @param {number} index
 * @returns
 */
function convertTriggerToControl(logger, entry, index) {
	/** @type {any} */
	const actions = []
	/** @type {any} */
	const control = {
		type: 'trigger',
		options: cloneDeep(ControlTrigger.DefaultOptions),
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
		case 'feedback':
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
		case 'variable':
			// Convert old variable type to new format
			control.events.push({
				id: nanoid(),
				type: 'condition_true',
				enabled: true,
				options: {},
			})

			const oldConfig = Array.isArray(entry.config) ? entry.config : [entry.config]
			for (let conf of oldConfig) {
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

/**
 *
 * @param {*} db
 * @param {*} logger
 */
function convertSchedulerToControls(db, logger) {
	if (db.hasKey('scheduler')) {
		let controls = db.getKey('controls')
		let scheduler = db.getKey('scheduler')

		if (Array.isArray(scheduler)) {
			// Convert into an object
			/** @type {any} */
			const obj = {}
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

		db.setKey('controls', controls)
		db.deleteKey('scheduler')
	}
}

/**
 *
 * @param {*} db
 */
function convertEmulatorToV3(db) {
	if (db.hasKey('userconfig')) {
		const userconfig = db.getKey('userconfig')

		const instances = db.getKey('deviceconfig')
		if (instances['emulator'] && instances['emulator'].config) {
			instances['emulator'].config.emulator_control_enable = userconfig.emulator_control_enable ?? false
			instances['emulator'].config.emulator_prompt_fullscreen = userconfig.emulator_prompt_fullscreen ?? false
		}

		if (instances['emulator'] && !instances['emulator:emulator']) {
			instances['emulator:emulator'] = instances['emulator']
			instances['emulator:emulator'].integrationType = 'emulator'
			delete instances['emulator']
		}
	}
}

/**
 *
 * @param {*} db
 * @returns
 */
function convertSurfacesToV3(db) {
	const devices = db.getKey('deviceconfig')
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
}

/**
 * do the database upgrades to convert from the v2 to the v3 format
 * @param {import('../Database.js').default} db
 * @param {import('winston').Logger} logger
 * @returns {void}
 */
function convertDatabaseToV3(db, logger) {
	convertInstancesToV3(db)

	convertToControls(db)

	convertSchedulerToControls(db, logger)

	convertEmulatorToV3(db)
	convertSurfacesToV3(db)
}

/**
 *
 * @param {*} oldObj
 * @returns
 */
function convertPageToV3(oldObj) {
	// find the old data
	const oldPageConfig = oldObj.config || {}
	const oldPageActions = oldObj.actions || {}
	const oldPageReleaseActions = oldObj.release_actions || {}
	const oldPageRotateLeftActions = oldObj.rotate_left_actions || {}
	const oldPageRotateRightActions = oldObj.rotate_right_actions || {}

	// create the new data
	/** @type {any} */
	const result = {
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

/**
 *
 * @param {*} control
 * @returns
 */
function fixUpControl(control) {
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

	for (const step of Object.values(control.steps || {})) {
		for (const set of Object.values(step.action_sets)) {
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

/**
 * @param {*} obj
 * @param {import('winston').Logger} logger
 * @returns
 */
function convertImportToSets(obj, logger) {
	if (obj.type == 'full') {
		/** @type {any} */
		const newObj = {
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
			newObj.triggers = obj.triggers.map((/** @type {any} */ trigger, /** @type {any} */ index) =>
				convertTriggerToControl(logger, trigger, index)
			)
		}

		return newObj
	} else {
		// type == 'page'
		/** @type {any} */
		const newObj = {
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

/**
 * @param {*} config
 */
function splitBankConfigToStyleAndOptions(config) {
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

/**
 * @param {*} style
 * @param {*[]} actions
 * @param {*[]} release_actions
 * @param {*[]} rotate_left_actions
 * @param {*[]} rotate_right_actions
 */
function combineActionsToStepsAndSets(style, actions, release_actions, rotate_left_actions, rotate_right_actions) {
	/** @type {any} */
	const bank_action_steps = {}
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
