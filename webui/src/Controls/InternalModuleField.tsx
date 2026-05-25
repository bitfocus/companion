import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { InternalInputField } from '@companion-app/shared/Model/Options.js'
import { HorizontalAlignmentInputField, VerticalAlignmentInputField } from '~/Components/AlignmentInputField.js'
import { DateInputField } from '~/Components/DateInputField.js'
import type { DropdownChoicesOrGroups } from '~/Components/DropdownChoices.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { ImageInputField } from '~/Components/ImageInputField.js'
import { MultiDropdownInputField } from '~/Components/MultiDropdownInputField.js'
import { TimeInputField } from '~/Components/TimeInputField.js'
import { VariablePickerField } from '~/Components/VariablePickerField.js'
import { groupItemsByCollection } from '~/Helpers/CollectionGrouping.js'
import { useComputed } from '~/Resources/util.js'
import type { GenericCollectionsStore } from '~/Stores/GenericCollectionsStore'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { LocalVariablesStore } from './LocalVariablesStore'

export function InternalModuleField(
	id: string | undefined,
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
					id={id}
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
					id={id}
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
					id={id}
					disabled={readonly}
					value={value}
					setValue={setValue}
					includeNone={option.includeNone}
				/>
			)
		case 'internal:variable':
			return (
				<InternalVariableDropdown
					id={id}
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
					id={id}
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
					id={id}
					disabled={readonly}
					isLocatedInGrid={isLocatedInGrid}
					value={value}
					setValue={setValue}
					includeSelf={option.includeSelf}
				/>
			)
		case 'internal:trigger_collection':
			return <InternalTriggerCollectionDropdown id={id} disabled={readonly} value={value} setValue={setValue} />
		case 'internal:connection_collection':
			return <InternalConnectionCollectionDropdown id={id} disabled={readonly} value={value} setValue={setValue} />
		case 'internal:time':
			return <TimeInputField id={id} disabled={readonly} value={value} setValue={setValue} />
		case 'internal:date':
			return <DateInputField id={id} disabled={readonly} value={value} setValue={setValue} />
		case 'internal:horizontal-alignment':
			return <HorizontalAlignmentInputField id={id} value={value} setValue={setValue} disabled={readonly} />
		case 'internal:vertical-alignment':
			return <VerticalAlignmentInputField id={id} value={value} setValue={setValue} disabled={readonly} />
		case 'internal:image-file': {
			return (
				<ImageInputField
					id={id}
					value={value}
					setValue={setValue}
					disabled={readonly}
					min={option.min}
					max={option.max}
				/>
			)
		}
		default:
			// Use fallback
			return null
	}
}

interface InternalConnectionIdDropdownProps {
	id: string | undefined
	includeAll: boolean | undefined
	value: any
	setValue: (value: any) => void
	disabled: boolean
	multiple: boolean
	filterActionsRecorder: boolean | undefined
}

const InternalConnectionIdDropdown = observer(function InternalConnectionIdDropdown({
	id,
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
		return (
			<MultiDropdownInputField
				htmlName={id}
				disabled={disabled}
				value={value}
				choices={choices}
				sortSelection
				setValue={setValue}
			/>
		)
	} else {
		return <DropdownInputField htmlName={id} disabled={disabled} value={value} choices={choices} setValue={setValue} />
	}
})

interface InternalPageDropdownProps {
	id: string | undefined
	isLocatedInGrid: boolean
	includeStartup: boolean | undefined
	includeDirection: boolean | undefined
	value: any
	setValue: (value: any) => void
	disabled: boolean
}

export const InternalPageDropdown = observer(function InternalPageDropdown({
	id,
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

	return <DropdownInputField htmlName={id} disabled={disabled} value={value} choices={choices} setValue={setValue} />
})

interface InternalPageIdDropdownProps {
	id: string | undefined
	// isLocatedInGrid: boolean
	includeStartup: boolean | undefined
	includeDirection: boolean | undefined
	value: any
	setValue: (value: any) => void
	disabled: boolean
	multiple?: boolean
}

export const InternalPageIdDropdown = observer(function InternalPageDropdown({
	id,
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
		return <DropdownInputField htmlName={id} disabled={disabled} value={value} choices={choices} setValue={setValue} />
	} else {
		return (
			<MultiDropdownInputField htmlName={id} disabled={disabled} value={value} choices={choices} setValue={setValue} />
		)
	}
})

interface InternalCustomVariableDropdownProps {
	id: string | undefined
	value: any
	setValue: (value: any) => void
	includeNone: boolean | undefined
	disabled?: boolean
}

export const InternalCustomVariableDropdown = observer(function InternalCustomVariableDropdown({
	id,
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
		<VariablePickerField htmlName={id} disabled={disabled} value={value ?? ''} choices={choices} setValue={setValue} />
	)
})

interface InternalVariableDropdownProps {
	id: string | undefined
	value: any
	setValue: (value: any) => void
	disabled: boolean
	supportsLocal: boolean
	localVariablesStore: LocalVariablesStore | null
}

const InternalVariableDropdown = observer(function InternalVariableDropdown({
	id,
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

	const onPasteIntercept = useCallback((pastedValue: string) => {
		let value = pastedValue.trim()
		if (value.length === 0) return pastedValue
		if (value.startsWith('$(') && value.endsWith(')')) {
			value = value.slice(2, -1)
		}

		return value
	}, [])

	return (
		<VariablePickerField
			htmlName={id}
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
	id: string | undefined
	isLocatedInGrid: boolean
	value: any
	setValue: (value: any) => void
	disabled: boolean
	includeSelf: boolean | undefined
	useRawSurfaces: boolean | undefined
}

const InternalSurfaceBySerialDropdown = observer(function InternalSurfaceBySerialDropdown({
	id,
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

	return <DropdownInputField htmlName={id} disabled={disabled} value={value} choices={choices} setValue={setValue} />
})

interface InternalTriggerDropdownProps {
	id: string | undefined
	isLocatedInGrid: boolean
	value: any
	setValue: (value: any) => void
	disabled: boolean
	includeSelf: boolean | 'abort' | undefined
}

const InternalTriggerDropdown = observer(function InternalTriggerDropdown({
	id,
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

	return <DropdownInputField htmlName={id} disabled={disabled} value={value} choices={choices} setValue={setValue} />
})

interface InternalTriggerCollectionDropdownProps {
	id: string | undefined
	value: any
	setValue: (value: any) => void
	disabled: boolean
}

const InternalTriggerCollectionDropdown = observer(function InternalTriggerCollectionDropdown({
	id,
	value,
	setValue,
	disabled,
}: InternalTriggerCollectionDropdownProps) {
	const { triggersList } = useContext(RootAppStoreContext)

	const choices = useCollectionChoices(triggersList)

	return <DropdownInputField htmlName={id} disabled={disabled} value={value} choices={choices} setValue={setValue} />
})

interface InternalConnectionCollectionDropdownProps {
	id: string | undefined
	value: any
	setValue: (value: any) => void
	disabled: boolean
}

const InternalConnectionCollectionDropdown = observer(function InternalConnectionCollectionDropdown({
	id,
	value,
	setValue,
	disabled,
}: InternalConnectionCollectionDropdownProps) {
	const { connections } = useContext(RootAppStoreContext)

	const choices = useCollectionChoices(connections)

	return <DropdownInputField htmlName={id} disabled={disabled} value={value} choices={choices} setValue={setValue} />
})

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
