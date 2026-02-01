import { validateActionSetId } from '@companion-app/shared/ControlId.js'
import type { ActionStepOptions } from '@companion-app/shared/Model/ActionModel.js'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'
import type {
	PresetDefinition,
	UIPresetDefinition,
	UIPresetGroup,
	UIPresetSection,
} from '@companion-app/shared/Model/Presets.js'
import type {
	CompanionPresetAction,
	CompanionPresetDefinition,
	CompanionPresetGroup,
	CompanionPresetSection,
	Complete,
	ModuleLogger,
} from '@companion-module/base'
import { convertActionsDelay, convertPresetFeedbacksToEntities, ConvertPresetStyleToDrawStyle } from './PresetUtils.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { nanoid } from 'nanoid'
import { exprVal } from '@companion-app/shared/Model/Options.js'

const DefaultStepOptions: Complete<ActionStepOptions> = {
	runWhileHeld: [],
	name: undefined,
}

export function ConvertPresetDefinitions(
	logger: ModuleLogger,
	connectionId: string,
	connectionUpgradeIndex: number | undefined,
	rawSections: CompanionPresetSection[]
): {
	presets: Record<string, PresetDefinition>
	uiPresets: Record<string, UIPresetSection>
} {
	const converter = new PresetDefinitionConverter(logger, connectionId, connectionUpgradeIndex)

	const uiPresets: Record<string, UIPresetSection> = {}

	try {
		rawSections?.forEach?.((rawSection, i) => {
			const section = converter.convertSection(rawSection, i)
			if (!section) return

			uiPresets[section.id] = section
		})

		if (converter.duplicatePresetIds.size > 0) {
			logger.warn(
				`Some preset ids are duplicated. Duplications have been dropped: ${Array.from(converter.duplicatePresetIds).join(', ')}`
			)
		}

		return {
			presets: converter.presetDefinitions,
			uiPresets,
		}
	} catch (e) {
		logger.error(`Converting presets failed: ${stringifyError(e)}`)
		return {
			presets: {},
			uiPresets: {},
		}
	}
}

class PresetDefinitionConverter {
	readonly #logger: ModuleLogger
	readonly #connectionId: string
	readonly #connectionUpgradeIndex: number | undefined

	readonly duplicatePresetIds = new Set<string>()
	readonly presetDefinitions: Record<string, PresetDefinition> = {}

	constructor(logger: ModuleLogger, connectionId: string, connectionUpgradeIndex: number | undefined) {
		this.#logger = logger
		this.#connectionId = connectionId
		this.#connectionUpgradeIndex = connectionUpgradeIndex
	}

	convertSection(section: CompanionPresetSection, i: number): UIPresetSection | null {
		try {
			if (!section.definitions || section.definitions.length === 0) return null

			const uiSection: Complete<UIPresetSection> = {
				id: section.id,
				name: section.name || '',
				order: i,
				description: section.description,
				definitions: {},
				tags: section.tags,
			}

			const presetGroups = section.definitions.filter((grp) => this.isGroup(grp))
			if (presetGroups.length > 0) {
				const invalidCount = section.definitions.length - presetGroups.length
				if (invalidCount > 0) {
					this.#logger.warn(`Found preset section "${section.name}" containing ${invalidCount} invalid definitions`)
				}

				const convertedGroups = presetGroups.map((grp, i) => this.convertGroup(grp, i)).filter((v) => !!v)
				uiSection.definitions = Object.fromEntries(convertedGroups.map((g) => [g.id, g]))

				return uiSection
			}

			const presetDefinitions = section.definitions.filter((def) => this.isPreset(def))
			if (presetDefinitions.length > 0) {
				const invalidCount = section.definitions.length - presetDefinitions.length
				if (invalidCount > 0) {
					this.#logger.warn(`Found preset section "${section.name}" containing ${invalidCount} invalid definitions`)
				}

				const convertedDefinitions = presetDefinitions
					.map((preset, i) => this.convertPreset(preset, i))
					.filter((v) => !!v)

				// Wrap in a group, for ui simplicity
				uiSection.definitions = {
					default: {
						type: 'custom',
						id: 'default',
						name: '',
						order: 0,
						description: undefined,
						presets: Object.fromEntries(convertedDefinitions.map((d) => [d.id, d])),
						tags: undefined,
					} satisfies Complete<UIPresetGroup>,
				}

				return uiSection
			}

			this.#logger.warn(
				`Found preset section "${section.name}" containing ${section.definitions.length} invalid definitions`
			)
			return null
		} catch (e) {
			this.#logger.error(
				`An error was encountered while sanitising the ${section?.name} preset section. It has been ignored: ${stringifyError(e, true)}`
			)
			return null
		}
	}

	convertGroup(group: CompanionPresetGroup, i: number): UIPresetGroup | null {
		const uiGroup: Complete<UIPresetGroup> = {
			type: 'custom',
			id: group.id,
			name: group.name,
			order: i,
			description: group.description,
			presets: {},
			tags: group.tags,
		}

		const convertedDefinitions = group.presets.map((preset, i) => this.convertPreset(preset, i)).filter((v) => !!v)
		if (convertedDefinitions.length === 0) return null

		uiGroup.presets = Object.fromEntries(convertedDefinitions.map((d) => [d.id, d]))

		return uiGroup
	}

	convertPreset(preset: CompanionPresetDefinition, i: number): UIPresetDefinition | null {
		// Check if an id is duplicated
		if (this.presetDefinitions[preset.id]) {
			this.duplicatePresetIds.add(preset.id)
			return null
		}

		const definition = ConvertPresetDefinition(
			this.#logger,
			this.#connectionId,
			this.#connectionUpgradeIndex,
			preset.id,
			preset
		)
		if (!definition) return null

		this.presetDefinitions[definition.id] = definition

		return {
			id: preset.id,
			order: i,
			label: preset.name,
		} satisfies Complete<UIPresetDefinition>
	}

	isGroup(obj: { type: string }): obj is CompanionPresetGroup {
		const objGroup = obj as CompanionPresetGroup
		switch (objGroup.type) {
			case 'custom':
				return true
			default:
				return false
		}
	}
	isPreset(obj: { type: string }): obj is CompanionPresetDefinition {
		const objPreset = obj as CompanionPresetDefinition
		switch (objPreset.type) {
			case 'simple':
				return true
			default:
				return false
		}
	}
}

function ConvertPresetDefinition(
	logger: ModuleLogger,
	connectionId: string,
	connectionUpgradeIndex: number | undefined,
	presetId: string,
	rawPreset: CompanionPresetDefinition
): PresetDefinition | null {
	try {
		if (rawPreset.type === 'simple') {
			const presetDefinition: PresetDefinition = {
				id: presetId,
				name: rawPreset.name,
				type: 'button',
				previewStyle: rawPreset.previewStyle,
				model: {
					type: 'button',
					options: {
						rotaryActions: false, // Populated later, if relevant actions are defined
						stepProgression: (rawPreset.options?.stepAutoProgress ?? true) ? 'auto' : 'manual',
					},
					style: ConvertPresetStyleToDrawStyle(rawPreset.style),
					feedbacks: convertPresetFeedbacksToEntities(rawPreset.feedbacks, connectionId, connectionUpgradeIndex),
					steps: {},
					localVariables: [],
				},
			}

			if (rawPreset.steps) {
				for (let i = 0; i < rawPreset.steps.length; i++) {
					const newStep: NormalButtonSteps[0] = {
						action_sets: {
							down: [],
							up: [],
							rotate_left: undefined,
							rotate_right: undefined,
						},
						options: structuredClone(DefaultStepOptions),
					}
					presetDefinition.model.steps[i] = newStep

					const rawStep = rawPreset.steps[i]
					if (!rawStep) continue

					if (rawStep.name) newStep.options.name = rawStep.name

					for (const [setId, set] of Object.entries(rawStep)) {
						if (setId === 'name') continue

						const setIdSafe = validateActionSetId(setId as any)
						if (setIdSafe === undefined) {
							logger.warn(`Invalid set id: ${setId}`)
							continue
						}

						if (setIdSafe === 'rotate_left' || setIdSafe === 'rotate_right') {
							// If there are rotary actions, then enable the option
							presetDefinition.model.options.rotaryActions = true
						}

						const setActions: CompanionPresetAction[] = Array.isArray(set) ? set : set.actions
						if (!isNaN(Number(setId)) && set.options?.runWhileHeld) newStep.options.runWhileHeld.push(Number(setId))

						if (setActions) {
							newStep.action_sets[setIdSafe] = convertActionsDelay(
								setActions,
								connectionId,
								true, // Always relative now
								connectionUpgradeIndex
							)
						}
					}
				}
			}

			// Ensure that there is at least one step
			if (Object.keys(presetDefinition.model.steps).length === 0) {
				presetDefinition.model.steps[0] = {
					action_sets: { down: [], up: [], rotate_left: undefined, rotate_right: undefined },
					options: structuredClone(DefaultStepOptions),
				}
			}

			// Copy across local variables
			if (rawPreset.localVariables) {
				for (const localVariable of rawPreset.localVariables) {
					switch (localVariable.variableType) {
						case 'simple':
							presetDefinition.model.localVariables.push({
								id: nanoid(),
								type: EntityModelType.Feedback,
								definitionId: 'user_value',
								connectionId: 'internal',
								upgradeIndex: undefined,

								variableName: localVariable.variableName,
								headline: localVariable.headline,

								options: {
									persist_value: exprVal(false),
									startup_value: exprVal(localVariable.startupValue),
								},
							})
							break
						default:
							logger.warn(`Unknown local variable type: ${localVariable.variableType}`)
							break
					}
				}
			}

			return presetDefinition
		} else {
			return null
		}
	} catch (e) {
		logger.warn(`Received invalid preset "${rawPreset.name}"(${presetId}): ${e}`)
		return null
	}
}
