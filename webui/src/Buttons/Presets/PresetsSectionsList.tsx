import { faArrowLeft, faClone, faLink, faSearch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useMemo, useState } from 'react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { UIPresetSection, UIPresetSections } from '@companion-app/shared/Model/Presets.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button, ButtonGroup } from '~/Components/Button'
import { Callout } from '~/Components/Callout.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { useComputed } from '~/Resources/util.js'
import { NonIdealState } from '../../Components/NonIdealState.js'
import { SearchBox } from '../../Components/SearchBox.js'
import { fuzzyMatch } from './fuzzyMatch.js'
import { PresetSectionCollapse } from './PresetSectionCollapse.js'
import { usePresetPlacementMode } from './usePresetPlacementMode.js'

interface PresetsSectionsListProps {
	presets: UIPresetSections | undefined
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
	const [searchQuery, setSearchQuery] = useState('')

	// Preset references (linked presets) are only supported by newer (2.0+) modules. For older modules the
	// toggle is disabled and presets are always placed as a copy.
	const supportsReferences = presets?.supportsReferences ?? false

	// The mode newly placed presets actually use - forced to 'copy' when the module can't support references,
	// regardless of the stored preference (which is left untouched so it applies again on a 2.0+ module).
	const [storedPlacementMode] = usePresetPlacementMode()
	const placementMode = supportsReferences ? storedPlacementMode : 'copy'

	const allSections = useComputed(
		() =>
			Object.values(presets?.sections || {})
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

	const allSectionIds = useMemo(() => allSections.map((s) => s.id), [allSections])

	const sections = visibleSections.map((section) => (
		<PresetSectionCollapse
			key={section.id}
			section={section}
			connectionId={selectedConnectionId}
			placementMode={placementMode}
		/>
	))

	return (
		<PanelCollapseHelperProvider
			storageId={`preset-sections-${selectedConnectionId}`}
			knownPanelIds={allSectionIds}
			defaultCollapsed={true}
			evictionOwner={{ kind: 'connection', id: selectedConnectionId }}
		>
			<div>
				<h5>Presets</h5>
				<div style={{ marginBottom: 10 }}>
					<ButtonGroup>
						<Button color="primary" size="sm" onClick={clearSelectedConnectionId}>
							<FontAwesomeIcon icon={faArrowLeft} />
							&nbsp; Go back
						</Button>
						<Button color="secondary" size="sm" disabled>
							{connectionInfo?.label || selectedConnectionId}
						</Button>
					</ButtonGroup>
				</div>
				<SearchBox filter={searchQuery} setFilter={setSearchQuery} className="mb-2" />
				{allSections.length === 0 ? (
					<StaticAlert color="primary">Connection has no presets.</StaticAlert>
				) : visibleSections.length === 0 && searchQuery ? (
					<NonIdealState icon={faSearch} text="No matching presets" />
				) : (
					<>
						<Callout color="info" className="my-2">
							<div className="d-flex align-items-center justify-content-between gap-3">
								<div>
									<strong>Drag and drop</strong> the preset buttons below into your buttons-configuration.
								</div>
								<PresetPlacementModeToggle supportsReferences={supportsReferences} />
							</div>
						</Callout>
						<div className="collapsible-tree">{sections}</div>
					</>
				)}
			</div>
		</PanelCollapseHelperProvider>
	)
})

function PresetPlacementModeToggle({ supportsReferences }: { supportsReferences: boolean }): React.JSX.Element {
	const [mode, setMode] = usePresetPlacementMode()

	// When the module doesn't support references, presets are always placed as a copy regardless of the
	// stored preference. The stored value is left untouched so it takes effect again on a 2.0+ module.
	const effectiveMode = supportsReferences ? mode : 'copy'
	const unsupportedTitle = 'Linked presets require a module built for the 2.0 (or newer) module api'

	return (
		<div
			className="d-flex align-items-center gap-2 flex-shrink-0"
			title={!supportsReferences ? unsupportedTitle : undefined}
		>
			<span className="text-muted small text-nowrap">When placed:</span>
			<ButtonGroup>
				<Button
					size="sm"
					color={effectiveMode === 'reference' ? 'primary' : 'secondary'}
					disabled={!supportsReferences}
					onClick={() => setMode('reference')}
					title={
						supportsReferences
							? 'Newly placed presets stay linked to the source preset and update automatically'
							: unsupportedTitle
					}
				>
					<FontAwesomeIcon icon={faLink} className="me-1" />
					Linked
				</Button>
				<Button
					size="sm"
					color={effectiveMode === 'copy' ? 'primary' : 'secondary'}
					disabled={!supportsReferences}
					onClick={() => setMode('copy')}
					title={supportsReferences ? 'Newly placed presets are a one-off copy you can freely edit' : unsupportedTitle}
				>
					<FontAwesomeIcon icon={faClone} className="me-1" />
					Copy
				</Button>
			</ButtonGroup>
		</div>
	)
}
