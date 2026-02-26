import React, { useCallback, useContext } from 'react'
import { DropdownInputField, MultiDropdownInputField, type DropdownChoicesOrGroups } from '~/Components/index.js'
import { useComputed } from '~/Resources/util.js'
import TimePicker from 'react-time-picker'
import DatePicker from 'react-date-picker'
import type { InternalInputField } from '@companion-app/shared/Model/Options.js'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { LocalVariablesStore } from './LocalVariablesStore'
import type { GenericCollectionsStore } from '~/Stores/GenericCollectionsStore'
import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'
import { groupItemsByCollection } from '~/Helpers/CollectionGrouping.js'

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

	const choices = useComputed((): DropdownChoicesOrGroups => {
		const allConnections = connections.sortedConnections()

		// Filter and convert connections to items for grouping
		const filterItem = (config: ClientConnectionConfig): boolean => {
			if (filterActionsRecorder && !config.hasRecordActionsHandler) return false
			return true
		}

		const getItemChoice = (config: ClientConnectionConfig): DropdownChoice => ({
			id: config.id,
			label: config.label ?? config.id,
		})

		const groupsOrItems = groupItemsByCollection(
			connections.rootCollections(),
			allConnections,
			getItemChoice,
			filterItem
		)

		// Add "All Connections" option at the beginning if requested
		if (includeAll) {
			const allChoice: DropdownChoice = { id: 'all', label: 'All Connections' }

			return [allChoice, ...groupsOrItems]
		}

		return groupsOrItems
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

	const choices = useComputed((): DropdownChoicesOrGroups => {
		interface MinimalCustomVariable {
			id: string
			description: string
			collectionId: string | null
		}

		// Convert custom variables Map to array of objects with id field
		const allCustomVariables = Array.from(customVariables.customVariables.entries()).map(
			([id, info]): MinimalCustomVariable => ({
				id,
				description: info.description,
				collectionId: info.collectionId || null,
			})
		)

		const getItemChoice = (variable: MinimalCustomVariable): DropdownChoice => ({
			id: variable.id,
			label: variable.description,
		})

		const groupsOrItems = groupItemsByCollection(
			customVariables.rootCustomVariableCollections(),
			allCustomVariables,
			getItemChoice
		)

		// Add "None" option at the beginning if requested
		if (includeNone) {
			const noneChoice: DropdownChoice = { id: '', label: 'None' }
			return [noneChoice, ...groupsOrItems]
		}

		return groupsOrItems
	}, [customVariables, includeNone])

	return (
		<DropdownInputField
			disabled={disabled}
			value={value ?? ''}
			choices={choices}
			setValue={setValue}
			fancyFormat={true}
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
				label: variable.description,
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
			fancyFormat={true}
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

	const choices = useComputed((): DropdownChoicesOrGroups => {
		const selfChoices: DropdownChoice[] = []

		// Add self options if needed
		if (!isLocatedInGrid && includeSelf) {
			if (includeSelf === 'abort') {
				selfChoices.push({ id: 'self', label: 'Current trigger: except this run' })
				selfChoices.push({ id: 'self:only-this-run', label: 'Current trigger: only this run' })
				selfChoices.push({ id: 'self:all-runs', label: 'Current trigger: all runs' })
			} else {
				selfChoices.push({ id: 'self', label: 'Current trigger' })
			}
		}

		interface MinimalTrigger {
			id: string
			name: string
			collectionId: string | null
		}

		// Convert triggers Map to array of objects with id field
		const allTriggers = Array.from(triggersList.triggers.entries()).map(
			([id, trigger]): MinimalTrigger => ({
				id,
				name: trigger.name,
				collectionId: trigger.collectionId || null,
			})
		)

		const getItemChoice = (trigger: MinimalTrigger): DropdownChoice => ({
			id: trigger.id,
			label: trigger.name || `Trigger #${trigger.id}`,
		})

		const groupsOrItems = groupItemsByCollection(triggersList.rootCollections(), allTriggers, getItemChoice)

		// Prepend self choices at the top (before all groups)
		return [...selfChoices, ...groupsOrItems]
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

	const choices = useCollectionChoices(triggersList)

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

	const choices = useCollectionChoices(connections)

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

function useCollectionChoices(listStore: GenericCollectionsStore<any>): DropdownChoice[] {
	return useComputed(() => {
		const choices: DropdownChoice[] = []

		const processCollections = (collections: CollectionBase<any>[], parentPath: string[]) => {
			for (const collection of collections) {
				const label = collection.label || `Collection #${collection.id}`
				const fullPath = [...parentPath, label].join(' / ')

				choices.push({
					id: collection.id,
					label: fullPath,
				})

				if (collection.children) {
					processCollections(collection.children, [...parentPath, label])
				}
			}
		}
		processCollections(listStore.rootCollections(), [])

		return choices
	}, [listStore])
}
