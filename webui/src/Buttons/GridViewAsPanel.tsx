import React, { useContext } from 'react'
import { CAlert, CCol, CForm, CFormLabel, CFormSwitch } from '@coreui/react'
import { PreventDefaultHandler, useComputed } from '../util.js'
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

	return (
		<div>
			<h5>View Grid As</h5>
			<p>Here you can change how the grid is displayed, to view it as a particular surface.</p>

			<CForm className="row g-3" onSubmit={PreventDefaultHandler}>
				<CFormLabel className="col-sm-2 col-form-label col-form-label-sm">View Enabled</CFormLabel>
				<CCol sm={9}>
					<CFormSwitch
						checked={gridViewAsController.enabled}
						onChange={(e) => gridViewAsController.setEnabled(!!e.currentTarget.checked)}
						size="xl"
					/>
				</CCol>
				<CCol sm={1}></CCol>

				<CFormLabel className="col-sm-2 col-form-label col-form-label-sm">Surface</CFormLabel>
				<CCol sm={9}>
					<DropdownInputField
						choices={gridViewAsController.surfaceChoices}
						multiple={false}
						value={gridViewAsController.selectedSurface.id}
						setValue={(value) => gridViewAsController.setSelectedSurface(value as GridViewSpecialSurface | string)}
					/>
				</CCol>
				<CCol sm={1}></CCol>

				{!gridViewAsController.selectedSurface.layout && (
					<CCol sm={12}>
						<CAlert color="warning">
							The layout of this surface is not known, the full grid will be shown instead
						</CAlert>
					</CCol>
				)}

				<CFormLabel className="col-sm-2 col-form-label col-form-label-sm">Surface Type</CFormLabel>
				<CCol sm={9}>
					<DropdownInputField
						choices={surfaceTypeChoices}
						multiple={false}
						disabled={gridViewAsController.selectedSurface.id !== GridViewSpecialSurface.Custom}
						value={gridViewAsController.selectedSurface.type}
						setValue={(value) => gridViewAsController.setCustomType(value as string)}
					/>
				</CCol>
				<CCol sm={1}></CCol>

				<CFormLabel className="col-sm-2 col-form-label col-form-label-sm">X Offset</CFormLabel>
				<CCol sm={9}>
					<NumberInputField
						value={gridViewAsController.selectedSurface.xOffset}
						disabled={gridViewAsController.selectedSurface.id !== GridViewSpecialSurface.Custom}
						setValue={gridViewAsController.setCustomXOffset}
					/>
				</CCol>
				<CCol sm={1}></CCol>

				<CFormLabel className="col-sm-2 col-form-label col-form-label-sm">Y Offset</CFormLabel>
				<CCol sm={9}>
					<NumberInputField
						value={gridViewAsController.selectedSurface.yOffset}
						disabled={gridViewAsController.selectedSurface.id !== GridViewSpecialSurface.Custom}
						setValue={gridViewAsController.setCustomYOffset}
					/>
				</CCol>
				<CCol sm={1}></CCol>
			</CForm>
		</div>
	)
})
