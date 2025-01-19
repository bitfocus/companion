import React, { useContext } from 'react'
import { CButton, CCallout } from '@coreui/react'
import type { UIPresetDefinition } from '@companion-app/shared/Model/Presets.js'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { faLifeRing } from '@fortawesome/free-solid-svg-icons'
import { NonIdealState } from '../../Components/NonIdealState.js'

interface PresetsConnectionListProps {
	presets: Record<string, Record<string, UIPresetDefinition> | undefined>
	setConnectionAndCategory: (info: [connectionId: string | null, category: string | null]) => void
}
export const PresetsConnectionList = observer(function PresetsConnectionList({
	presets,
	setConnectionAndCategory,
}: PresetsConnectionListProps) {
	const { modules, connections } = useContext(RootAppStoreContext)

	// Sort the connections by the same order as the connections list
	const sortedPresets = Object.entries(presets).sort(
		([a], [b]) =>
			(connections.getInfo(a)?.sortOrder ?? Number.POSITIVE_INFINITY) -
			(connections.getInfo(b)?.sortOrder ?? Number.POSITIVE_INFINITY)
	)

	const options = sortedPresets.map(([id, vals]) => {
		if (!vals || Object.values(vals).length === 0) return ''

		const connectionInfo = connections.getInfo(id)
		const moduleInfo = connectionInfo ? modules.modules.get(connectionInfo.instance_type) : undefined
		const compactName = connectionInfo ? modules.getModuleFriendlyName(connectionInfo.instance_type) : undefined

		return (
			<CButton
				title={moduleInfo?.display?.name}
				key={id}
				color="primary"
				onClick={() => setConnectionAndCategory([id, null])}
			>
				<h6>{connectionInfo?.label ?? id}</h6> <small>{compactName ?? '?'}</small>
			</CButton>
		)
	})

	return (
		<div>
			<h5>Presets</h5>
			<p>
				Ready made buttons with text, actions and feedback which you can drop onto a button to help you get started
				quickly.
			</p>

			{options.length === 0 ? (
				<div style={{ border: '1px solid #e9e9e9', borderRadius: 5 }}>
					<NonIdealState icon={faLifeRing} text="You have no connections that support presets at the moment." />
				</div>
			) : (
				<div className="preset-category-grid">{options}</div>
			)}

			<CCallout color="warning">
				Not every module provides presets, and you can do a lot more by editing the actions and feedbacks on a button
				manually.
			</CCallout>
		</div>
	)
})
