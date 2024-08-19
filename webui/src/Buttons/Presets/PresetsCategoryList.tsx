import React, { useCallback } from 'react'
import { CAlert, CButton, CButtonGroup } from '@coreui/react'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Common.js'
import type { UIPresetDefinition } from '@companion-app/shared/Model/Presets.js'
import type { ModuleDisplayInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'

interface PresetsCategoryListProps {
	presets: Record<string, UIPresetDefinition>
	connectionInfo: ClientConnectionConfig
	moduleInfo: ModuleDisplayInfo | undefined
	selectedConnectionId: string
	setConnectionAndCategory: (info: [connectionId: string | null, category: string | null]) => void
}
export function PresetsCategoryList({
	presets,
	connectionInfo,
	moduleInfo,
	selectedConnectionId,
	setConnectionAndCategory,
}: Readonly<PresetsCategoryListProps>) {
	const categories = new Set<string>()
	for (const preset of Object.values(presets)) {
		categories.add(preset.category)
	}

	const doBack = useCallback(() => setConnectionAndCategory([null, null]), [setConnectionAndCategory])

	const buttons = Array.from(categories)
		.sort((a, b) => a.localeCompare(b))
		.map((category) => {
			return (
				<CButton
					key={category}
					color="primary"
					onClick={() => setConnectionAndCategory([selectedConnectionId, category])}
				>
					{category}
				</CButton>
			)
		})

	return (
		<div>
			<h5>Presets</h5>
			<div style={{ marginBottom: 10 }}>
				<CButtonGroup size="sm">
					<CButton color="primary" onClick={doBack}>
						<FontAwesomeIcon icon={faArrowLeft} />
						&nbsp; Go back
					</CButton>
					<CButton color="secondary" disabled>
						{moduleInfo?.name || '?'} ({connectionInfo?.label || selectedConnectionId})
					</CButton>
				</CButtonGroup>
			</div>
			{buttons.length === 0 ? (
				<CAlert color="primary">Connection has no presets.</CAlert>
			) : (
				<div className="preset-category-grid">{buttons}</div>
			)}
		</div>
	)
}
