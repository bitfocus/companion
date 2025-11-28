import React, { useCallback, useContext } from 'react'
import { DropdownInputField, MultiDropdownInputField } from '~/Components/index.js'
import { useComputed } from '~/Resources/util.js'
import TimePicker from 'react-time-picker'
import DatePicker from 'react-date-picker'
import type { InternalInputField } from '@companion-app/shared/Model/Options.js'
import type { DropdownChoice } from '@companion-module/base'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import type { TriggerCollection } from '@companion-app/shared/Model/TriggerModel.js'
import type { ConnectionCollection } from '@companion-app/shared/Model/Connections.js'
import type { LocalVariablesStore } from './LocalVariablesStore'
import {
	/* Select,*/ components as SelectComponents,
	//createFilter,
	//type ControlProps,
	type OptionProps,
	//type ValueContainerProps,
} from 'react-select'
import type { DropdownChoiceInt } from '~/LocalVariableDefinitions.js'

export function InternalModuleField(
	option: InternalInputField,
	isLocatedInGrid: boolean,
	localVariablesStore: LocalVariablesStore | null,
	readonly: boolean,
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	value: any,
	setValue: (value: any) => void
): JSX.Element | null {
	switch (option.type) {
		case 'internal:connection_id':
			return (
				<InternalConnectionIdDropdown
					disabled={readonly}
					value={value}
					includeAll={option.includeAll}
					multiple={option.multiple}
					setValue={setValue}
					filterActionsRecorder={option.filterActionsRecorder}
				/>
			)
		case 'internal:page':
			return (
				<InternalPageDropdown
					disabled={readonly}
					isLocatedInGrid={isLocatedInGrid}
					includeDirection={option.includeDirection}
					includeStartup={option.includeStartup}
					value={value}
					setValue={setValue}
				/>
			)
		case 'internal:custom_variable':
			return (
				<InternalCustomVariableDropdown
					disabled={readonly}
					value={value}
					setValue={setValue}
					includeNone={option.includeNone}
				/>
			)
		case 'internal:variable':
			return (
				<InternalVariableDropdown
					disabled={readonly}
					value={value}
					setValue={setValue}
					supportsLocal={option.supportsLocal}
					localVariablesStore={localVariablesStore}
				/>
			)
		case 'internal:surface_serial':
			return (
				<InternalSurfaceBySerialDropdown
					disabled={readonly}
					isLocatedInGrid={isLocatedInGrid}
					value={value}
					setValue={setValue}
					includeSelf={option.includeSelf}
					useRawSurfaces={option.useRawSurfaces}
				/>
			)
		case 'internal:trigger':
			return (
				<InternalTriggerDropdown
					disabled={readonly}
					isLocatedInGrid={isLocatedInGrid}
					value={value}
					setValue={setValue}
					includeSelf={option.includeSelf}
				/>
			)
		case 'internal:trigger_collection':
			return <InternalTriggerCollectionDropdown disabled={readonly} value={value} setValue={setValue} />
		case 'internal:connection_collection':
			return <InternalConnectionCollectionDropdown disabled={readonly} value={value} setValue={setValue} />
		case 'internal:time':
			return <InternalTimePicker disabled={readonly} value={value} setValue={setValue} />
		case 'internal:date':
			return <InternalDatePicker disabled={readonly} value={value} setValue={setValue} />
		default:
			// Use fallback
			return null
	}
}

interface InternalConnectionIdDropdownProps {
	includeAll: boolean | undefined
	value: any
	setValue: (value: any) => void
	disabled: boolean
	multiple: boolean
	filterActionsRecorder: boolean | undefined
}

const InternalConnectionIdDropdown = observer(function InternalConnectionIdDropdown({
	includeAll,
	value,
	setValue,
	disabled,
	multiple,
	filterActionsRecorder,
}: Readonly<InternalConnectionIdDropdownProps>) {
	const { connections } = useContext(RootAppStoreContext)

	const choices = useComputed(() => {
		const connectionChoices = []
		if (includeAll) {
			connectionChoices.push({ id: 'all', label: 'All Connections' })
		}

		for (const [id, config] of connections.connections.entries()) {
			if (filterActionsRecorder && !config.hasRecordActionsHandler) continue

			connectionChoices.push({ id, label: config.label ?? id })
		}
		return connectionChoices
	}, [connections, includeAll, filterActionsRecorder])

	if (multiple) {
		return <MultiDropdownInputField disabled={disabled} value={value} choices={choices} setValue={setValue} />
	} else {
		return <DropdownInputField disabled={disabled} value={value} choices={choices} setValue={setValue} />
	}
})

interface InternalPageDropdownProps {
	isLocatedInGrid: boolean
	includeStartup: boolean | undefined
	includeDirection: boolean | undefined
	value: any
	setValue: (value: any) => void
	disabled: boolean
}

export const InternalPageDropdown = observer(function InternalPageDropdown({
	isLocatedInGrid,
	includeStartup,
	includeDirection,
	value,
	setValue,
	disabled,
}: InternalPageDropdownProps) {
	const { pages } = useContext(RootAppStoreContext)

	const choices = useComputed(() => {
		const choices: DropdownChoice[] = []
		if (isLocatedInGrid) {
			choices.push({ id: 0, label: 'This page' })
		}
		if (includeStartup) {
			choices.push({ id: 'startup', label: 'Startup page' })
		}
		if (includeDirection) {
			choices.push({ id: 'back', label: 'Back' }, { id: 'forward', label: 'Forward' })
		}

		pages.data.forEach((pageInfo, i) => {
			choices.push({ id: i + 1, label: `${i + 1} (${pageInfo.name || ''})` })
		})

		return choices
	}, [pages, isLocatedInGrid, includeStartup, includeDirection])

	return <DropdownInputField disabled={disabled} value={value} choices={choices} setValue={setValue} />
})

interface InternalPageIdDropdownProps {
	// isLocatedInGrid: boolean
	includeStartup: boolean | undefined
	includeDirection: boolean | undefined
	value: any
	setValue: (value: any) => void
	disabled: boolean
	multiple?: boolean
}

export const InternalPageIdDropdown = observer(function InternalPageDropdown({
	// isLocatedInGrid,
	includeStartup,
	includeDirection,
	value,
	setValue,
	disabled,
	multiple,
}: InternalPageIdDropdownProps) {
	const { pages } = useContext(RootAppStoreContext)

	const choices = useComputed(() => {
		const choices: DropdownChoice[] = []
		// if (isLocatedInGrid) {
		// 	choices.push({ id: 0, label: 'This page' })
		// }
		if (includeStartup) {
			choices.push({ id: 'startup', label: 'Startup page' })
		}
		if (includeDirection) {
			choices.push({ id: 'back', label: 'Back' }, { id: 'forward', label: 'Forward' })
		}

		pages.data.forEach((pageInfo, i) => {
			choices.push({ id: pageInfo.id, label: `${i + 1} (${pageInfo.name || ''})` })
		})

		return choices
	}, [pages, /*isLocatedInGrid,*/ includeStartup, includeDirection])

	if (multiple === undefined || !multiple) {
		return <DropdownInputField disabled={disabled} value={value} choices={choices} setValue={setValue} />
	} else {
		return <MultiDropdownInputField disabled={disabled} value={value} choices={choices} setValue={setValue} />
	}
})

// Formatting for variable pulldown options:
const CustomOption = React.memo((props: OptionProps<DropdownChoiceInt>) => {
	const { data } = props
	return (
		<SelectComponents.Option {...props} className={(props.className ?? '') + 'variable-dropdown-option'}>
			<span className="var-name">{data.value}</span>
			<span className="var-label">{data.label}</span>
		</SelectComponents.Option>
	)
})

// Formatting for variable "single value" (shown when dropdown is closed) -- uses a different CSS class
const CustomSingleValue = React.memo((props: OptionProps<DropdownChoiceInt>) => {
	const { data } = props
	return (
		<SelectComponents.Option {...props} className={(props.className ?? '') + 'variable-dropdown-single'}>
			<div className="var-name">{data.value}</div>
			<div className="var-label">{data.label}</div>
		</SelectComponents.Option>
	)
})

interface InternalCustomVariableDropdownProps {
	value: any
	setValue: (value: any) => void
	includeNone: boolean | undefined
	disabled?: boolean
}

export const InternalCustomVariableDropdown = observer(function InternalCustomVariableDropdown({
	value,
	setValue,
	includeNone,
	disabled,
}: Readonly<InternalCustomVariableDropdownProps>) {
	const { variablesStore: customVariables } = useContext(RootAppStoreContext)

	const choices = useComputed(() => {
		const choices: DropdownChoice[] = []

		if (includeNone) {
			choices.push({
				id: '',
				label: 'None',
			})
		}

		const customVariablesSorted = Array.from(customVariables.customVariables.entries()).sort(
			(a, b) => a[1].sortOrder - b[1].sortOrder
		)

		for (const [id, info] of customVariablesSorted) {
			choices.push({
				id,
				label: `${info.description}`,
			})
		}

		return choices
	}, [customVariables, includeNone])

	return (
		<DropdownInputField
			disabled={disabled}
			value={value ?? ''}
			choices={choices}
			setValue={setValue}
			selectComponents={{ Option: CustomOption, SingleValue: CustomSingleValue }}
		/>
	)
})

interface InternalVariableDropdownProps {
	value: any
	setValue: (value: any) => void
	disabled: boolean
	supportsLocal: boolean
	localVariablesStore: LocalVariablesStore | null
}

const InternalVariableDropdown = observer(function InternalVariableDropdown({
	value,
	setValue,
	disabled,
	supportsLocal,
	localVariablesStore,
}: Readonly<InternalVariableDropdownProps>) {
	const { variablesStore } = useContext(RootAppStoreContext)

	const baseVariableDefinitions = variablesStore.allVariableDefinitions.get()
	const localVariableDefinitions = supportsLocal ? localVariablesStore?.getOptions(null, true, false) : undefined
	const choices = useComputed(() => {
		const choices: Array<DropdownChoice> = []

		console.log('Local variable definitions', localVariableDefinitions)
		if (localVariableDefinitions) {
			for (const definition of localVariableDefinitions) {
				choices.push({
					id: definition.value,
					label: `${definition.label} (${definition.value})`,
				})
			}
		}

		for (const variable of baseVariableDefinitions) {
			const id = `${variable.connectionLabel}:${variable.name}`
			choices.push({
				id,
				label: `${variable.label}`,
			})
		}

		choices.sort((a, b) => String(a.id).localeCompare(String(b.id)))

		return choices
	}, [baseVariableDefinitions, localVariableDefinitions])

	const hasMatch = choices.find((c) => c.id === value)

	const onPasteIntercept = useCallback((pastedValue: string) => {
		let value = pastedValue.trim()
		if (value.length === 0) return pastedValue
		if (value.startsWith('$(') && value.endsWith(')')) {
			value = value.slice(2, -1)
		}

		return value
	}, [])

	return (
		<DropdownInputField
			className={hasMatch ? '' : 'select-warning'}
			disabled={disabled}
			value={value ?? ''}
			choices={choices}
			setValue={setValue}
			regex="/^([\w-_]+):([a-zA-Z0-9-_\.]+)$/"
			allowCustom /* Allow specifying a variable which doesnt currently exist, perhaps as something is offline */
			onPasteIntercept={onPasteIntercept}
			selectComponents={{ Option: CustomOption, SingleValue: CustomSingleValue }}
		/>
	)
})

interface InternalSurfaceBySerialDropdownProps {
	isLocatedInGrid: boolean
	value: any
	setValue: (value: any) => void
	disabled: boolean
	includeSelf: boolean | undefined
	useRawSurfaces: boolean | undefined
}

const InternalSurfaceBySerialDropdown = observer(function InternalSurfaceBySerialDropdown({
	isLocatedInGrid,
	value,
	setValue,
	disabled,
	includeSelf,
	useRawSurfaces,
}: InternalSurfaceBySerialDropdownProps) {
	const { surfaces } = useContext(RootAppStoreContext)

	const choices = useComputed(() => {
		const choices: DropdownChoice[] = []
		if (isLocatedInGrid && includeSelf) {
			choices.push({ id: 'self', label: 'Current surface' })
		}

		if (!useRawSurfaces) {
			for (const group of surfaces.store.values()) {
				if (!group) continue

				choices.push({
					label: group.displayName,
					id: group.id,
				})
			}
		} else {
			for (const group of surfaces.store.values()) {
				if (!group) continue

				for (const surface of group.surfaces) {
					choices.push({
						label: surface.displayName,
						id: surface.id,
					})
				}
			}
		}

		return choices
	}, [surfaces, isLocatedInGrid, includeSelf, useRawSurfaces])

	return <DropdownInputField disabled={disabled} value={value} choices={choices} setValue={setValue} />
})

interface InternalTriggerDropdownProps {
	isLocatedInGrid: boolean
	value: any
	setValue: (value: any) => void
	disabled: boolean
	includeSelf: boolean | 'abort' | undefined
}

const InternalTriggerDropdown = observer(function InternalTriggerDropdown({
	isLocatedInGrid,
	value,
	setValue,
	disabled,
	includeSelf,
}: InternalTriggerDropdownProps) {
	const { triggersList } = useContext(RootAppStoreContext)

	const choices = useComputed(() => {
		const choices: DropdownChoice[] = []
		if (!isLocatedInGrid && includeSelf) {
			if (includeSelf === 'abort') {
				choices.push({ id: 'self', label: 'Current trigger: except this run' })
				choices.push({ id: 'self:only-this-run', label: 'Current trigger: only this run' })
				choices.push({ id: 'self:all-runs', label: 'Current trigger: all runs' })
			} else {
				choices.push({ id: 'self', label: 'Current trigger' })
			}
		}

		for (const [id, trigger] of triggersList.triggers.entries()) {
			choices.push({
				id: id,
				label: trigger.name || `Trigger #${id}`,
			})
		}
		return choices
	}, [triggersList, isLocatedInGrid, includeSelf])

	return <DropdownInputField disabled={disabled} value={value} choices={choices} setValue={setValue} />
})

interface InternalTriggerCollectionDropdownProps {
	value: any
	setValue: (value: any) => void
	disabled: boolean
}

const InternalTriggerCollectionDropdown = observer(function InternalTriggerCollectionDropdown({
	value,
	setValue,
	disabled,
}: InternalTriggerCollectionDropdownProps) {
	const { triggersList } = useContext(RootAppStoreContext)

	const choices = useComputed(() => {
		const choices: DropdownChoice[] = []

		const processCollections = (collections: TriggerCollection[]) => {
			for (const collection of collections) {
				choices.push({
					id: collection.id,
					label: collection.label || `Collection #${collection.id}`,
				})
			}
		}
		processCollections(triggersList.rootCollections())

		return choices
	}, [triggersList])

	return <DropdownInputField disabled={disabled} value={value} choices={choices} setValue={setValue} />
})

interface InternalConnectionCollectionDropdownProps {
	value: any
	setValue: (value: any) => void
	disabled: boolean
}

const InternalConnectionCollectionDropdown = observer(function InternalConnectionCollectionDropdown({
	value,
	setValue,
	disabled,
}: InternalConnectionCollectionDropdownProps) {
	const { connections } = useContext(RootAppStoreContext)

	const choices = useComputed(() => {
		const choices: DropdownChoice[] = []

		const processCollections = (collections: ConnectionCollection[]) => {
			for (const collection of collections) {
				choices.push({
					id: collection.id,
					label: collection.label || `Collection #${collection.id}`,
				})
				if (collection.children) {
					processCollections(collection.children)
				}
			}
		}
		processCollections(connections.rootCollections())

		return choices
	}, [connections])

	return <DropdownInputField disabled={disabled} value={value} choices={choices} setValue={setValue} />
})

interface InternalTimePickerProps {
	value: any
	setValue: (value: any) => void
	disabled: boolean
}

function InternalTimePicker({ value, setValue, disabled }: InternalTimePickerProps) {
	return (
		<>
			<TimePicker
				disabled={disabled}
				format="HH:mm:ss"
				maxDetail="second"
				required
				value={value}
				onChange={setValue}
				className={''}
				openClockOnFocus={false}
			/>
		</>
	)
}

interface InternalDatePickerProps {
	value: any
	setValue: (value: any) => void
	disabled: boolean
}

function InternalDatePicker({ value, setValue, disabled }: InternalDatePickerProps) {
	return (
		<>
			<DatePicker
				disabled={disabled}
				format="yyyy-M-dd"
				minDate={new Date()}
				required
				value={value}
				onChange={setValue}
				className={''}
				showLeadingZeros={true}
				calendarIcon={null}
				yearPlaceholder="yyyy"
				monthPlaceholder="mm"
				dayPlaceholder="dd"
			/>
		</>
	)
}
