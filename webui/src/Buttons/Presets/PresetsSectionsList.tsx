import React, { useMemo } from 'react'
import { CAlert, CButton, CButtonGroup, CCallout } from '@coreui/react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { UIPresetSection } from '@companion-app/shared/Model/Presets.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { PresetSectionCollapse } from './PresetSectionCollapse'
import { observable } from 'mobx'

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

	const sections = Object.values(presets || {})
		.filter((p) => !!p)
		.sort((a, b) => a.order - b.order)
		.map((section) => (
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
			{sections.length === 0 ? (
				<CAlert color="primary">Connection has no presets.</CAlert>
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
