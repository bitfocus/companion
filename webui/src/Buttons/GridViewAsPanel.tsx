import React, { useCallback, useContext, useEffect, useState } from 'react'
import { CAlert, CButton, CRow } from '@coreui/react'
import { ConnectionsContext, useComputed } from '../util.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { GridViewSpecialSurface, useGridViewAs } from './GridViewAs.js'
import { DropdownInputField, NumberInputField } from '../Components/index.js'

export const GridViewAsPanel = observer(function GridViewAsPanel() {
	const { socket, surfaces } = useContext(RootAppStoreContext)

	const viewController = useGridViewAs()

	// const options = Object.entries(presets).map(([id, vals]) => {
	// 	if (!vals || Object.values(vals).length === 0) return ''

	// 	const connectionInfo = connectionsContext[id]
	// 	const moduleInfo = connectionInfo ? modules.modules.get(connectionInfo.instance_type) : undefined

	// 	return (
	// 		<CButton key={id} color="danger" onClick={() => setConnectionAndCategory([id, null])}>
	// 			{moduleInfo?.name ?? '?'} ({connectionInfo?.label ?? id})
	// 		</CButton>
	// 	)
	// })

	const surfaceTypeChoices = useComputed(() => {
		if (viewController.selectedSurface.id === GridViewSpecialSurface.Custom) {
			return []
		} else {
			// Field is disabled, show just the current value
			return [
				{
					id: viewController.selectedSurface.type,
					label: viewController.selectedSurface.type,
				},
			]
		}
	}, [surfaces, viewController.selectedSurface.id])

	return (
		<div>
			<h5>View Grid As</h5>
			<p>Here you can change how the grid is displayed, to view it as a particular surface.</p>

			<DropdownInputField
				label="Surface"
				choices={viewController.surfaceChoices}
				multiple={false}
				value={viewController.selectedSurface.id}
				setValue={(value) => viewController.setSelectedSurface(value as GridViewSpecialSurface | string)}
			/>

			<DropdownInputField
				label="Surface Type"
				choices={surfaceTypeChoices}
				multiple={false}
				disabled={viewController.selectedSurface.id !== GridViewSpecialSurface.Custom}
				value={viewController.selectedSurface.type}
				setValue={(value) => {
					console.log('type', value)
				}}
			/>

			<NumberInputField
				label="X Offset"
				value={viewController.selectedSurface.xOffset}
				disabled={viewController.selectedSurface.id !== GridViewSpecialSurface.Custom}
				setValue={() => {}}
			/>

			<NumberInputField
				label="Y Offset"
				value={viewController.selectedSurface.yOffset}
				disabled={viewController.selectedSurface.id !== GridViewSpecialSurface.Custom}
				setValue={() => {}}
			/>
		</div>
	)
})
