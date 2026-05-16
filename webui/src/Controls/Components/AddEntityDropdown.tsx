import { Combobox } from '@base-ui/react/combobox'
import { prepare as fuzzyPrepare, single as fuzzySingle } from 'fuzzysort'
import { ChevronDownIcon } from 'lucide-react'
import { toJS } from 'mobx'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useRef, useState } from 'react'
import { canAddEntityToFeedbackList } from '@companion-app/shared/Entity.js'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import { FeedbackEntitySubType, type EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { DropdownInputPopup } from '~/Components/DropdownInputField/Popup'
import { MenuPortalContext } from '~/Components/MenuPortalContext'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface AddEntityOption extends DropdownChoice {
	isRecent: boolean
	sortKey: string
	fuzzy: ReturnType<typeof fuzzyPrepare>
}
interface AddEntityGroup {
	id: string
	label: string
	items: AddEntityOption[]
}
interface AddEntityDropdownProps {
	onSelect: (connectionId: string, definitionId: string) => void
	entityType: EntityModelType
	entityTypeLabel: string
	feedbackListType: ClientEntityDefinition['feedbackType']
	disabled: boolean
}
export const AddEntityDropdown = observer(function AddEntityDropdown({
	onSelect,
	entityType,
	entityTypeLabel,
	feedbackListType,
	disabled,
}: AddEntityDropdownProps) {
	const { entityDefinitions, connections } = useContext(RootAppStoreContext)
	const menuPortal = useContext(MenuPortalContext)

	const definitions = entityDefinitions.getEntityDefinitionsStore(entityType)
	const recentlyUsedStore = entityDefinitions.getRecentlyUsedEntityDefinitionsStore(entityType)

	const options = useComputed(() => {
		const groups: Array<AddEntityGroup> = []
		const allConnectionOptions: AddEntityOption[] = []
		const pushConnection = (connectionId: string, label: string) => {
			const entityDefinitions = definitions.connections.get(connectionId)
			if (!entityDefinitions) return

			const connectionOptions: AddEntityOption[] = []

			for (const [definitionId, definition] of entityDefinitions.entries()) {
				if (!canAddEntityToFeedbackList(feedbackListType, definition)) continue

				const optionLabel = `${label}: ${definition.label}`
				connectionOptions.push({
					isRecent: false,
					id: `${connectionId}:${definitionId}`,
					label: optionLabel,
					sortKey: String(definition.sortKey ?? definition.label),
					fuzzy: fuzzyPrepare(optionLabel),
				})
			}

			connectionOptions.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { sensitivity: 'base' }))

			allConnectionOptions.push(...connectionOptions)
		}

		pushConnection('internal', 'internal')
		for (const connection of connections.sortedConnections()) {
			pushConnection(connection.id, connection.label)
		}
		groups.push({ id: '__all__', label: '', items: allConnectionOptions })

		if (feedbackListType === FeedbackEntitySubType.Value) {
			// Show the builtin value type options as special, to increase visibility
			const internalDefs = definitions.connections.get('internal')
			if (internalDefs) {
				const commonOptions: AddEntityOption[] = []

				for (const [definitionId, definition] of internalDefs.entries()) {
					if (
						!canAddEntityToFeedbackList(feedbackListType, definition) ||
						definition.feedbackType !== FeedbackEntitySubType.Value
					)
						continue

					const optionLabel = `internal: ${definition.label}`
					commonOptions.push({
						isRecent: true, // Not really, but should behave the same
						id: `internal:${definitionId}`,
						label: optionLabel,
						sortKey: definition.sortKey ?? definition.label,
						fuzzy: fuzzyPrepare(optionLabel),
					})
				}

				groups.push({
					id: '__common__',
					label: 'Common',
					items: commonOptions,
				})
			}
		}

		const recents: AddEntityOption[] = []
		for (const definitionPair of recentlyUsedStore.recentIds) {
			if (!definitionPair) continue

			const [connectionId, definitionId] = definitionPair.split(':', 2)
			const definition = definitions.connections.get(connectionId)?.get(definitionId)
			if (!definition) continue

			if (!canAddEntityToFeedbackList(feedbackListType, definition)) continue

			const connectionLabel = connections.getLabel(connectionId) ?? connectionId
			const optionLabel = `${connectionLabel}: ${definition.label}`
			recents.push({
				isRecent: true,
				id: `${connectionId}:${definitionId}`,
				label: optionLabel,
				sortKey: definition.sortKey ?? definition.label,
				fuzzy: fuzzyPrepare(optionLabel),
			})
		}
		groups.push({
			id: '__recent__',
			label: 'Recently Used',
			items: recents,
		})

		return groups
	}, [definitions, connections, recentlyUsedStore.recentIds, feedbackListType])

	const onChange = useCallback(
		(id: DropdownChoice['id'] | null) => {
			if (!id) return
			const id2 = String(id)
			recentlyUsedStore.trackId(id2)

			const [connectionId, definitionId] = id2.split(':', 2)
			onSelect(connectionId, definitionId)
		},
		[onSelect, recentlyUsedStore]
	)

	const inputRef = useRef<HTMLInputElement>(null)

	const [inputValue, setInputValue] = useState<string>('')

	const onOpenChange = useCallback((open: boolean) => {
		if (!open) {
			inputRef.current?.blur()
		}
	}, [])

	const filterOptions = useComputed<Array<AddEntityGroup> | undefined>(() => {
		const filterArray = <T extends AddEntityOption | AddEntityGroup>(options: Array<T>) => {
			const res: Array<T> = []

			for (const option of options) {
				if ('items' in option) {
					const children = filterArray(option.items)
					if (children.length === 0) {
						continue
					}

					res.push({
						...option,
						items: children,
					})
				} else {
					const include = inputValue
						? !option.isRecent && (fuzzySingle(inputValue, option.fuzzy)?.score ?? 0) >= 0.5
						: option.isRecent
					if (include) res.push(option)
				}
			}

			return res
		}

		return toJS(filterArray(options))
	}, [options, inputValue])

	return (
		<div className="dropdown-field">
			<Combobox.Root<DropdownChoice['id'] | null>
				value={null}
				items={options}
				multiple={false}
				autoHighlight
				onValueChange={onChange}
				onInputValueChange={setInputValue}
				onOpenChange={onOpenChange}
				disabled={disabled}
				filteredItems={filterOptions}
			>
				<Combobox.InputGroup className="dropdown-field-input-group rounded-end-0">
					<Combobox.Input className="dropdown-field-input" placeholder={`+ Add ${entityTypeLabel}`} ref={inputRef} />
					<Combobox.Trigger className="dropdown-field-trigger">
						<ChevronDownIcon className="dropdown-field-icon" />
					</Combobox.Trigger>
				</Combobox.InputGroup>
				<DropdownInputPopup
					menuPortal={menuPortal ?? undefined}
					noOptionsMessage={inputValue ? `No ${entityTypeLabel}s found` : `No recently used ${entityTypeLabel}s`}
				/>
			</Combobox.Root>
		</div>
	)
})
