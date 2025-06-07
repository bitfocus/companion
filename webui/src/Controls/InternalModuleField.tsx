import React, { useCallback, useContext, useMemo } from 'react'
import { DropdownInputField, MultiDropdownInputField } from '~/Components/index.js'
import { useComputed } from '~/util.js'
import TimePicker from 'react-time-picker'
import DatePicker from 'react-date-picker'
import { InternalInputField } from '@companion-app/shared/Model/Options.js'
import { DropdownChoice } from '@companion-module/base'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { TriggerCollection } from '@companion-app/shared/Model/TriggerModel.js'

export function InternalModuleField(
	option: InternalInputField,
	isLocatedInGrid: boolean,
	readonly: boolean,
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
			return <InternalVariableDropdown disabled={readonly} value={value} setValue={setValue} />
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
}

export const InternalPageIdDropdown = observer(function InternalPageDropdown({
	// isLocatedInGrid,
	includeStartup,
	includeDirection,
	value,
	setValue,
	disabled,
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

	return <DropdownInputField disabled={disabled} value={value} choices={choices} setValue={setValue} />
})

interface InternalCustomVariableDropdownProps {
	label?: React.ReactNode
	value: any
	setValue: (value: any) => void
	includeNone: boolean | undefined
	disabled?: boolean
}

export const InternalCustomVariableDropdown = observer(function InternalCustomVariableDropdown({
	label,
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
				label: `${info.description} (custom:${id})`,
			})
		}

		return choices
	}, [customVariables, includeNone])

	return (
		<DropdownInputField label={label} disabled={disabled} value={value ?? ''} choices={choices} setValue={setValue} />
	)
})

interface InternalVariableDropdownProps {
	value: any
	setValue: (value: any) => void
	disabled: boolean
}

const InternalVariableDropdown = observer(function InternalVariableDropdown({
	value,
	setValue,
	disabled,
}: Readonly<InternalVariableDropdownProps>) {
	const { variablesStore } = useContext(RootAppStoreContext)

	const baseVariableDefinitions = variablesStore.allVariableDefinitions.get()
	const choices = useMemo(() => {
		const choices = []

		for (const variable of baseVariableDefinitions) {
			const id = `${variable.connectionLabel}:${variable.name}`
			choices.push({
				id,
				label: `${variable.label} (${id})`,
			})
		}

		choices.sort((a, b) => a.id.localeCompare(b.id))

		return choices
	}, [baseVariableDefinitions])

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
