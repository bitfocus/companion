import React, { useCallback, useContext } from 'react'
import { ConnectionsContext, useComputed } from '../util.js'
import Select, { createFilter } from 'react-select'
import { MenuPortalContext } from '../Components/DropdownInputField.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'

const baseFilter = createFilter<AddFeedbackOption>()
const filterOptions: ReturnType<typeof createFilter<AddFeedbackOption>> = (candidate, input) => {
	if (input) {
		return !candidate.data.isRecent && baseFilter(candidate, input)
	} else {
		return candidate.data.isRecent
	}
}

const noOptionsMessage = ({ inputValue }: { inputValue: string }) => {
	if (inputValue) {
		return 'No feedbacks found'
	} else {
		return 'No recently used feedbacks'
	}
}

export interface AddFeedbackOption {
	isRecent: boolean
	value: string
	label: string
}
interface AddFeedbackGroup {
	label: string
	options: AddFeedbackOption[]
}
interface AddFeedbackDropdownProps {
	onSelect: (feedbackType: string) => void
	booleanOnly: boolean
	addPlaceholder: string
}
export const AddFeedbackDropdown = observer(function AddFeedbackDropdown({
	onSelect,
	booleanOnly,
	addPlaceholder,
}: AddFeedbackDropdownProps) {
	const { feedbackDefinitions, recentlyAddedFeedbacks } = useContext(RootAppStoreContext)
	const menuPortal = useContext(MenuPortalContext)
	const connectionsContext = useContext(ConnectionsContext)

	const options = useComputed(() => {
		const options: Array<AddFeedbackOption | AddFeedbackGroup> = []
		for (const [connectionId, instanceFeedbacks] of feedbackDefinitions.connections.entries()) {
			for (const [feedbackId, feedback] of instanceFeedbacks.entries()) {
				if (!booleanOnly || feedback.type === 'boolean') {
					const connectionLabel = connectionsContext[connectionId]?.label ?? connectionId
					options.push({
						isRecent: false,
						value: `${connectionId}:${feedbackId}`,
						label: `${connectionLabel}: ${feedback.label}`,
					})
				}
			}
		}

		const recents: AddFeedbackOption[] = []
		for (const feedbackType of recentlyAddedFeedbacks.recentIds) {
			if (feedbackType) {
				const [connectionId, feedbackId] = feedbackType.split(':', 2)
				const feedbackInfo = feedbackDefinitions.connections.get(connectionId)?.get(feedbackId)
				if (feedbackInfo) {
					const connectionLabel = connectionsContext[connectionId]?.label ?? connectionId
					recents.push({
						isRecent: true,
						value: `${connectionId}:${feedbackId}`,
						label: `${connectionLabel}: ${feedbackInfo.label}`,
					})
				}
			}
		}

		options.push({
			label: 'Recently Used',
			options: recents,
		})

		return options
	}, [feedbackDefinitions, connectionsContext, booleanOnly, recentlyAddedFeedbacks.recentIds])

	const innerChange = useCallback(
		(e: AddFeedbackOption | null) => {
			if (e?.value) {
				recentlyAddedFeedbacks.trackId(e.value)

				onSelect(e.value)
			}
		},
		[onSelect, recentlyAddedFeedbacks]
	)

	return (
		<Select
			menuShouldBlockScroll={!!menuPortal} // The dropdown doesn't follow scroll when in a modal
			menuPortalTarget={menuPortal || document.body}
			menuPosition={'fixed'}
			classNamePrefix="select-control"
			menuPlacement="auto"
			isClearable={false}
			isSearchable={true}
			isMulti={false}
			options={options}
			placeholder={addPlaceholder || '+ Add feedback'}
			value={null}
			onChange={innerChange}
			filterOption={filterOptions}
			noOptionsMessage={noOptionsMessage}
		/>
	)
})
