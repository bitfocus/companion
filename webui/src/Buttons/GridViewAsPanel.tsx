import React, { useCallback, useContext, useEffect, useState } from 'react'
import { CAlert, CButton, CRow } from '@coreui/react'
import { ConnectionsContext, useComputed } from '../util.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { GridViewAsController, GridViewSpecialSurface } from './GridViewAs.js'
import { DropdownInputField, NumberInputField } from '../Components/index.js'

interface GridViewAsPanelProps {
	gridViewAsController: GridViewAsController
}

export const GridViewAsPanel = observer(function GridViewAsPanel({ gridViewAsController }: GridViewAsPanelProps) {
	const { surfaces } = useContext(RootAppStoreContext)

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
		if (gridViewAsController.selectedSurface.id === GridViewSpecialSurface.Custom) {
			return []
		} else {
			// Field is disabled, show just the current value
			return [
				{
					id: gridViewAsController.selectedSurface.type,
					label: gridViewAsController.selectedSurface.type,
				},
			]
		}
	}, [surfaces, gridViewAsController.selectedSurface.id])

	return (
		<div>
			<h5>View Grid As</h5>
			<p>Here you can change how the grid is displayed, to view it as a particular surface.</p>

			<DropdownInputField
				label="Surface"
				choices={gridViewAsController.surfaceChoices}
				multiple={false}
				value={gridViewAsController.selectedSurface.id}
				setValue={(value) => gridViewAsController.setSelectedSurface(value as GridViewSpecialSurface | string)}
			/>

			<DropdownInputField
				label="Surface Type"
				choices={surfaceTypeChoices}
				multiple={false}
				disabled={gridViewAsController.selectedSurface.id !== GridViewSpecialSurface.Custom}
				value={gridViewAsController.selectedSurface.type}
				setValue={(value) => {
					console.log('type', value)
				}}
			/>

			<NumberInputField
				label="X Offset"
				value={gridViewAsController.selectedSurface.xOffset}
				disabled={gridViewAsController.selectedSurface.id !== GridViewSpecialSurface.Custom}
				setValue={() => {}}
			/>

			<NumberInputField
				label="Y Offset"
				value={gridViewAsController.selectedSurface.yOffset}
				disabled={gridViewAsController.selectedSurface.id !== GridViewSpecialSurface.Custom}
				setValue={() => {}}
			/>
		</div>
	)
})
