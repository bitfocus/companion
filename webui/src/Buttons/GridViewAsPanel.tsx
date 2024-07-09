import React, { useCallback, useContext, useEffect, useState } from 'react'
import { CAlert, CButton, CRow } from '@coreui/react'
import { ConnectionsContext, useComputed } from '../util.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { GridViewAsController, GridViewSpecialSurface } from './GridViewAs.js'
import { DropdownInputField, NumberInputField } from '../Components/index.js'
import { DropdownChoice } from '@companion-module/base'

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

	const surfaceTypeChoices: DropdownChoice[] = useComputed(() => {
		if (gridViewAsController.selectedSurface.id === GridViewSpecialSurface.Custom) {
			return surfaces.layouts.map((layout) => ({
				id: layout.id,
				label: layout.name,
			}))
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

	console.log(gridViewAsController.selectedSurface, surfaceTypeChoices)

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

			{gridViewAsController.selectedSurface.id !== GridViewSpecialSurface.None &&
				!gridViewAsController.selectedSurface.layout && (
					<CAlert color="warning">The layout of this surface is not known, the full grid will be shown instead</CAlert>
				)}

			<DropdownInputField
				label="Surface Type"
				choices={surfaceTypeChoices}
				multiple={false}
				disabled={gridViewAsController.selectedSurface.id !== GridViewSpecialSurface.Custom}
				value={gridViewAsController.selectedSurface.type}
				setValue={(value) => gridViewAsController.setCustomType(value as string)}
			/>

			<NumberInputField
				label="X Offset"
				value={gridViewAsController.selectedSurface.xOffset}
				disabled={gridViewAsController.selectedSurface.id !== GridViewSpecialSurface.Custom}
				setValue={gridViewAsController.setCustomXOffset}
			/>

			<NumberInputField
				label="Y Offset"
				value={gridViewAsController.selectedSurface.yOffset}
				disabled={gridViewAsController.selectedSurface.id !== GridViewSpecialSurface.Custom}
				setValue={gridViewAsController.setCustomYOffset}
			/>
		</div>
	)
})
