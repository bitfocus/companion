import React, { useMemo, useState } from 'react'
import { CAlert, CButton, CButtonGroup, CCallout } from '@coreui/react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { UIPresetSection } from '@companion-app/shared/Model/Presets.js'
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

	const allSections = useComputed(
		() =>
			Object.values(presets || {})
				.filter((p) => !!p)
				.sort((a, b) => a.order - b.order),
		[presets]
	)

	// Filter sections and groups based on search query
	// Groups are shown/hidden as a whole - we don't hide individual presets within a group
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
								// Check if any preset within this group matches
								const hasMatchingPreset = Object.values(grp.presets).some((preset) => {
									try {
										return !searchQuery || fuzzyMatch(searchQuery, preset.label, preset.keywords?.join(' '))
									} catch (_err) {
										return false
									}
								})

								// Include entire group if section matches, group matches, or any preset matches
								if (sectionMatchesSearch || groupMatchesSearch || hasMatchingPreset) {
									filteredGroups[groupId] = grp
								}
							} else if (grp.type === 'template') {
								// For template groups, check if template label matches or any template value label matches
								const hasMatchingTemplateValue = grp.templateValues.some((templateValue) => {
									try {
										return !searchQuery || fuzzyMatch(searchQuery, templateValue.label ?? '')
									} catch (_err) {
										return false
									}
								})

								const definitionMatchesSearch =
									!searchQuery || fuzzyMatch(searchQuery, grp.definition.label, grp.definition.keywords?.join(' '))

								// Include entire group if section matches, group matches, definition matches, or any template value matches
								if (sectionMatchesSearch || groupMatchesSearch || definitionMatchesSearch || hasMatchingTemplateValue) {
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
