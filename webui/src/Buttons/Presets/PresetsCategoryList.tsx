import React, { useMemo } from 'react'
import { CAlert, CButton, CButtonGroup, CCallout } from '@coreui/react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { UIPresetDefinition } from '@companion-app/shared/Model/Presets.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { PresetButtonsCollapse } from './PresetButtonsCollapse'
import { observable } from 'mobx'

interface PresetsCategoryListProps {
	presets: Map<string, UIPresetDefinition> | undefined
	connectionInfo: ClientConnectionConfig | undefined
	moduleInfo: ClientModuleInfo | undefined
	selectedConnectionId: string
	clearSelectedConnectionId: () => void
}
export const PresetsCategoryList = observer(function PresetsCategoryList({
	presets,
	connectionInfo,
	selectedConnectionId,
	clearSelectedConnectionId,
}: Readonly<PresetsCategoryListProps>): React.JSX.Element {
	const categories = new Set<string>()
	for (const preset of presets?.values() || []) {
		categories.add(preset.category)
	}

	const expandedCategory = useMemo(() => observable.box<string | null>(null), [])

	const buttons = Array.from(categories)
		.sort((a, b) => a.localeCompare(b))
		.map((category) => (
			<PresetButtonsCollapse
				key={category}
				presets={presets}
				category={category}
				connectionId={selectedConnectionId}
				expandedCategory={expandedCategory}
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
			{buttons.length === 0 ? (
				<CAlert color="primary">Connection has no presets.</CAlert>
			) : (
				<>
					<CCallout color="info" className="my-2">
						<strong>Drag and drop</strong> the preset buttons below into your buttons-configuration.
					</CCallout>
					<div>{buttons}</div>
				</>
			)}
		</div>
	)
})
