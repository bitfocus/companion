import React, { useMemo, useState } from 'react'
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

	const allSections = Object.values(presets || {})
		.filter((p) => !!p)
		.sort((a, b) => a.order - b.order)

	// Filter sections, groups, and presets based on search query and selected tags
	const visibleSections = useComputed(() => {
		return allSections
			.map((section) => {
				try {
					// Check if section itself matches
					const sectionMatchesSearch =
						!searchQuery || fuzzyMatch(searchQuery, section.name, section.description, section.keywords?.join(' '))

					// Filter groups within this section
					const filteredGroups: Record<string, (typeof section.definitions)[string]> = {}

					for (const [groupId, grp] of Object.entries(section.definitions)) {
						try {
							const groupMatchesSearch =
								!searchQuery || fuzzyMatch(searchQuery, grp.name, grp.description, grp.keywords?.join(' '))

							if (grp.type === 'simple') {
								// Filter presets within this group
								const filteredPresets: typeof grp.presets = {}

								for (const [presetId, preset] of Object.entries(grp.presets)) {
									try {
										const presetMatchesSearch =
											!searchQuery || fuzzyMatch(searchQuery, preset.label, preset.keywords?.join(' '))

										// Include preset if it matches both search AND tags (or if section/group matches)
										if (sectionMatchesSearch || groupMatchesSearch || presetMatchesSearch) {
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
							} else if (grp.type === 'template') {
								// // For template, check if template values match search
								// const templateMatchesSearch =
								// 	!searchQuery ||
								// 	Object.values(grp.templateValues).some((values) =>
								// 		values.some((v) => fuzzyMatch(searchQuery, stringifyVariableValue(v) ?? ''))
								// 	)
								// // Include matrix group if it matches (matrices don't have individual preset tags)
								// if (
								// 	(sectionMatchesSearch && sectionMatchesTags) ||
								// 	(groupMatchesSearch && groupMatchesTags) ||
								// 	(matrixMatchesSearch && selectedTags.length === 0)
								// ) {
								filteredGroups[groupId] = grp
								// }
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
	}, [allSections, searchQuery])

	const sections = visibleSections.map((section) => (
		<PresetSectionCollapse
			key={section.id}
			section={section}
			connectionId={selectedConnectionId}
			expandedSection={expandedSection}
		/>
	))

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
			{allSections.length === 0 ? (
				<CAlert color="primary">Connection has no presets.</CAlert>
			) : visibleSections.length === 0 && searchQuery ? (
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
