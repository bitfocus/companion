import React, { useMemo, useState, useCallback } from 'react'
import { CAlert, CButton, CButtonGroup, CCallout, CFormLabel } from '@coreui/react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { UIPresetSection } from '@companion-app/shared/Model/Presets.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faSearch } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { PresetSectionCollapse } from './PresetSectionCollapse.js'
import { observable } from 'mobx'
import { SearchBox } from '../../Components/SearchBox.js'
import { NonIdealState } from '../../Components/NonIdealState.js'
import { fuzzyMatch } from './fuzzyMatch.js'
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'
import Select from 'react-select'

interface PresetsSectionsListProps {
	presets: Record<string, UIPresetSection | undefined> | undefined
	connectionInfo: ClientConnectionConfig | undefined
	moduleInfo: ClientModuleInfo | undefined
	selectedConnectionId: string
	clearSelectedConnectionId: () => void
}
export const PresetsSectionsList = observer(function PresetsCategoryList({
	presets,
	connectionInfo,
	selectedConnectionId,
	clearSelectedConnectionId,
}: Readonly<PresetsSectionsListProps>): React.JSX.Element {
	const expandedSection = useMemo(() => observable.box<string | null>(null), [])
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedTags, setSelectedTags] = useState<string[]>([])

	const allSections = Object.values(presets || {})
		.filter((p) => !!p)
		.sort((a, b) => a.order - b.order)

	// Collect all unique tags from sections, groups, and presets
	const allTags = useMemo(() => {
		const tagSet = new Set<string>()

		for (const section of allSections) {
			// Add section tags
			if (section.tags) {
				section.tags.forEach((tag) => tagSet.add(tag))
			}

			// Add group and preset tags
			for (const group of Object.values(section.definitions)) {
				if (group.tags) {
					group.tags.forEach((tag) => tagSet.add(tag))
				}

				if (group.type === 'custom') {
					for (const preset of Object.values(group.presets)) {
						if (preset.tags) {
							preset.tags.forEach((tag) => tagSet.add(tag))
						}
					}
				}
			}
		}

		return Array.from(tagSet).sort()
	}, [allSections])

	// Helper function to check if any of the selected tags match
	const hasMatchingTag = useCallback(
		(tags: string[] | undefined): boolean => {
			if (selectedTags.length === 0) return true
			if (!tags || tags.length === 0) return false
			return tags.some((tag) => selectedTags.includes(tag))
		},
		[selectedTags]
	)

	// Filter sections based on search query and selected tags
	const visibleSections = React.useMemo(() => {
		return allSections.filter((section) => {
			// First apply search query filter
			let searchMatches = true
			if (searchQuery) {
				const sectionMatches = fuzzyMatch(searchQuery, section.name, section.description, section.tags)
				if (!sectionMatches) {
					searchMatches = Object.values(section.definitions).some((grp) => {
						if (grp.type === 'custom') {
							const groupMatches = fuzzyMatch(searchQuery, grp.name, grp.description, grp.tags)
							if (groupMatches) return true

							return Object.values(grp.presets).some((preset) => fuzzyMatch(searchQuery, preset.label, preset.tags))
						} else if (grp.type === 'matrix') {
							const groupMatches = fuzzyMatch(searchQuery, grp.name, grp.description, grp.tags)
							if (groupMatches) return true

							return Object.values(grp.matrix).some((values) =>
								values.some((v) => fuzzyMatch(searchQuery, stringifyVariableValue(v) ?? ''))
							)
						}
						return false
					})
				}
			}

			if (!searchMatches) return false

			// Then apply tag filter
			if (selectedTags.length === 0) return true

			// Check if section has matching tag
			if (hasMatchingTag(section.tags)) return true

			// Check if any group or preset has matching tag
			return Object.values(section.definitions).some((grp) => {
				if (hasMatchingTag(grp.tags)) return true

				if (grp.type === 'custom') {
					return Object.values(grp.presets).some((preset) => hasMatchingTag(preset.tags))
				}

				return false
			})
		})
	}, [allSections, searchQuery, selectedTags, hasMatchingTag])

	const sections = visibleSections.map((section) => (
		<PresetSectionCollapse
			key={section.id}
			section={section}
			connectionId={selectedConnectionId}
			expandedSection={expandedSection}
		/>
	))

	const tagOptions = allTags.map((tag) => ({ value: tag, label: tag }))
	const selectedTagOptions = selectedTags.map((tag) => ({ value: tag, label: tag }))

	return (
		<div>
			<h5>Presets</h5>
			<div style={{ marginBottom: 10 }}>
				<CButtonGroup size="sm">
					<CButton color="primary" onClick={clearSelectedConnectionId}>
						<FontAwesomeIcon icon={faArrowLeft} />
						&nbsp; Go back
					</CButton>
					<CButton color="secondary" disabled>
						{connectionInfo?.label || selectedConnectionId}
					</CButton>
				</CButtonGroup>
			</div>
			<SearchBox filter={searchQuery} setFilter={setSearchQuery} />
			{allTags.length > 0 && (
				<div style={{ marginTop: 10, marginBottom: 10 }}>
					<Select
						isMulti
						isClearable
						options={tagOptions}
						value={selectedTagOptions}
						onChange={(newValue) => setSelectedTags(newValue ? newValue.map((v) => v.value) : [])}
						placeholder="Select tags..."
					/>
				</div>
			)}
			{allSections.length === 0 ? (
				<CAlert color="primary">Connection has no presets.</CAlert>
			) : visibleSections.length === 0 && (searchQuery || selectedTags.length > 0) ? (
				<NonIdealState icon={faSearch} text="No matching presets" />
			) : (
				<>
					<CCallout color="info" className="my-2">
						<strong>Drag and drop</strong> the preset buttons below into your buttons-configuration.
					</CCallout>
					<div>{sections}</div>
				</>
			)}
		</div>
	)
})
