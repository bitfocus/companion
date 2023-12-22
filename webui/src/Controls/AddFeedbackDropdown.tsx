import React, { memo, useCallback, useContext, useMemo } from 'react'
import { FeedbacksContext, ConnectionsContext, RecentFeedbacksContext } from '../util'
import Select, { createFilter } from 'react-select'
import { MenuPortalContext } from '../Components/DropdownInputField'
import { FilterOptionOption } from 'react-select/dist/declarations/src/filters'

const baseFilter = createFilter<AddFeedbackOption>()
const filterOptions = (candidate: FilterOptionOption<AddFeedbackOption>, input: string) => {
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
export const AddFeedbackDropdown = memo(function AddFeedbackDropdown({
	onSelect,
	booleanOnly,
	addPlaceholder,
}: AddFeedbackDropdownProps) {
	const recentFeedbacksContext = useContext(RecentFeedbacksContext)
	const menuPortal = useContext(MenuPortalContext)
	const feedbacksContext = useContext(FeedbacksContext)
	const connectionsContext = useContext(ConnectionsContext)

	const options = useMemo(() => {
		const options: Array<AddFeedbackOption | AddFeedbackGroup> = []
		for (const [connectionId, instanceFeedbacks] of Object.entries(feedbacksContext)) {
			for (const [feedbackId, feedback] of Object.entries(instanceFeedbacks || {})) {
				if (!feedback) continue
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
		for (const feedbackType of recentFeedbacksContext?.recentFeedbacks ?? []) {
			if (feedbackType) {
				const [connectionId, feedbackId] = feedbackType.split(':', 2)
				const feedbackInfo = feedbacksContext[connectionId]?.[feedbackId]
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
	}, [feedbacksContext, connectionsContext, booleanOnly, recentFeedbacksContext?.recentFeedbacks])

	const innerChange = useCallback(
		(e: AddFeedbackOption | null) => {
			if (e?.value) {
				recentFeedbacksContext?.trackRecentFeedback(e.value)

				onSelect(e.value)
			}
		},
		[onSelect, recentFeedbacksContext]
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
