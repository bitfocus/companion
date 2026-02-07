import React, { useMemo, useState, useCallback } from 'react'
import { CAlert, CButton, CButtonGroup, CCallout } from '@coreui/react'
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
import { useComputed } from '~/Resources/util.js'

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
	const allTags = useComputed(() => {
		const tagSet = new Set<string>()

		for (const section of allSections) {
			try {
				// Add section tags
				if (Array.isArray(section.tags)) {
					section.tags.forEach((tag) => tagSet.add(tag))
				}

				// Add group and preset tags
				for (const group of Object.values(section.definitions)) {
					try {
						if (Array.isArray(group.tags)) {
							group.tags.forEach((tag) => tagSet.add(tag))
						}

						if (group.type === 'custom') {
							for (const preset of Object.values(group.presets)) {
								try {
									if (Array.isArray(preset.tags)) {
										preset.tags.forEach((tag) => tagSet.add(tag))
									}
								} catch (_err) {
									// Ignore presets with bad tags
								}
							}
						}
					} catch (_err) {
						// Ignore groups with bad tags or data
					}
				}
			} catch (_err) {
				// Ignore sections with bad tags or data
			}
		}

		return Array.from(tagSet).sort()
	}, [allSections])

	// Helper function to check if any of the selected tags match
	const hasMatchingTag = useCallback(
		(tags: string[] | undefined): boolean => {
			try {
				if (selectedTags.length === 0) return true
				if (!Array.isArray(tags) || tags.length === 0) return false
				return tags.some((tag) => selectedTags.includes(tag))
			} catch (_err) {
				// If tag matching fails, hide the item
				return false
			}
		},
		[selectedTags]
	)

	// Filter sections, groups, and presets based on search query and selected tags
	const visibleSections = useComputed(() => {
		return allSections
			.map((section) => {
				try {
					// Check if section itself matches
					const sectionMatchesSearch =
						!searchQuery || fuzzyMatch(searchQuery, section.name, section.description, section.tags)
					const sectionMatchesTags = hasMatchingTag(section.tags)

					// Filter groups within this section
					const filteredGroups: Record<string, (typeof section.definitions)[string]> = {}

					for (const [groupId, grp] of Object.entries(section.definitions)) {
						try {
							const groupMatchesSearch = !searchQuery || fuzzyMatch(searchQuery, grp.name, grp.description, grp.tags)
							const groupMatchesTags = hasMatchingTag(grp.tags)

							if (grp.type === 'custom') {
								// Filter presets within this group
								const filteredPresets: typeof grp.presets = {}

								for (const [presetId, preset] of Object.entries(grp.presets)) {
									try {
										const presetMatchesSearch = !searchQuery || fuzzyMatch(searchQuery, preset.label, preset.tags)
										const presetMatchesTags = hasMatchingTag(preset.tags)

										// Include preset if it matches both search AND tags (or if section/group matches)
										if (
											(sectionMatchesSearch && sectionMatchesTags) ||
											(groupMatchesSearch && groupMatchesTags) ||
											(presetMatchesSearch && presetMatchesTags)
										) {
											filteredPresets[presetId] = preset
										}
									} catch (_err) {
										// Ignore presets with bad data
									}
								}

								// Include group if it has matching presets or matches itself
								if (Object.keys(filteredPresets).length > 0) {
									filteredGroups[groupId] = { ...grp, presets: filteredPresets }
								}
							} else if (grp.type === 'matrix') {
								// For matrix, check if matrix values match search
								const matrixMatchesSearch =
									!searchQuery ||
									Object.values(grp.matrix).some((values) =>
										values.some((v) => fuzzyMatch(searchQuery, stringifyVariableValue(v) ?? ''))
									)

								// Include matrix group if it matches (matrices don't have individual preset tags)
								if (
									(sectionMatchesSearch && sectionMatchesTags) ||
									(groupMatchesSearch && groupMatchesTags) ||
									(matrixMatchesSearch && selectedTags.length === 0)
								) {
									filteredGroups[groupId] = grp
								}
							}
						} catch (_err) {
							// Ignore groups with bad data
						}
					}

					// Only include section if it has matching groups
					if (Object.keys(filteredGroups).length > 0) {
						return { ...section, definitions: filteredGroups }
					}

					return null
				} catch (_err) {
					// Ignore sections with bad data
					return null
				}
			})
			.filter((section): section is UIPresetSection => section !== null)
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
