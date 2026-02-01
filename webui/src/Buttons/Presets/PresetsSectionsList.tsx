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
import { stringifyVariableValue } from '@companion-app/shared/Model/Variables.js'

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

	// Filter sections based on search query at root level
	const visibleSections = React.useMemo(() => {
		if (!searchQuery) return allSections

		return allSections.filter((section) => {
			// Check if section or any of its groups/presets match the search
			const sectionMatches = fuzzyMatch(searchQuery, section.name, section.description, section.tags)
			if (sectionMatches) return true

			// Check if any group has matching content
			return Object.values(section.definitions).some((grp) => {
				if (grp.type === 'custom') {
					const groupMatches = fuzzyMatch(searchQuery, grp.name, grp.description, grp.tags)
					if (groupMatches) return true

					// Check individual presets
					return Object.values(grp.presets).some((preset) => fuzzyMatch(searchQuery, preset.label, preset.tags))
				} else if (grp.type === 'matrix') {
					const groupMatches = fuzzyMatch(searchQuery, grp.name, grp.description, grp.tags)
					if (groupMatches) return true

					// Check matrix values
					return Object.values(grp.matrix).some((values) =>
						values.some((v) => fuzzyMatch(searchQuery, stringifyVariableValue(v) ?? ''))
					)
				}
				return false
			})
		})
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
