import { faArrowLeft, faClone, faLink, faSearch } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Search, X } from 'lucide-react'
import { observer } from 'mobx-react-lite'
import { useMemo, useState } from 'react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { UIPresetSection, UIPresetSections } from '@companion-app/shared/Model/Presets.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { useComputed } from '~/Resources/util.js'
import { NonIdealState } from '../../Components/NonIdealState.js'
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
			<div className="buttons-sidebar-section presets-panel">
				<div className="buttons-sidebar-heading-row">
					<h5 className="buttons-sidebar-heading">Presets</h5>
				</div>
				<div className="presets-detail-navigation">
					<Button variant="ghost" size="sm" onClick={clearSelectedConnectionId}>
						<FontAwesomeIcon icon={faArrowLeft} /> Back
					</Button>
					<span title={connectionInfo?.label || selectedConnectionId}>
						{connectionInfo?.label || selectedConnectionId}
					</span>
				</div>
				<div className="presets-search">
					<Search size={16} aria-hidden="true" />
					<input
						type="search"
						aria-label="Search presets"
						placeholder="Search presets..."
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
					/>
					{searchQuery && (
						<button type="button" onClick={() => setSearchQuery('')} aria-label="Clear preset search">
							<X size={14} />
						</button>
					)}
				</div>
				{allSections.length === 0 ? (
					<StaticAlert color="primary">Connection has no presets.</StaticAlert>
				) : visibleSections.length === 0 && searchQuery ? (
					<NonIdealState icon={faSearch} text="No matching presets" />
				) : (
					<>
						<div className="presets-placement-card">
							<strong>Drag to add</strong>
							<p>Drop a preset onto a button in the grid.</p>
							<PresetPlacementModeToggle supportsReferences={supportsReferences} />
						</div>
						<div className="collapsible-tree presets-sections-tree">{sections}</div>
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
		<div className="presets-placement-mode" title={!supportsReferences ? unsupportedTitle : undefined}>
			<span>Placement mode</span>
			<div className="presets-placement-options" role="group" aria-label="Preset placement mode">
				<button
					type="button"
					className={effectiveMode === 'reference' ? 'selected' : undefined}
					aria-pressed={effectiveMode === 'reference'}
					disabled={!supportsReferences}
					onClick={() => setMode('reference')}
					title={
						supportsReferences
							? 'Newly placed presets stay linked to the source preset and update automatically'
							: unsupportedTitle
					}
				>
					<FontAwesomeIcon icon={faLink} />
					Linked
				</button>
				<button
					type="button"
					className={effectiveMode === 'copy' ? 'selected' : undefined}
					aria-pressed={effectiveMode === 'copy'}
					disabled={!supportsReferences}
					onClick={() => setMode('copy')}
					title={supportsReferences ? 'Newly placed presets are a one-off copy you can freely edit' : unsupportedTitle}
				>
					<FontAwesomeIcon icon={faClone} />
					Copy
				</button>
			</div>
		</div>
	)
}
