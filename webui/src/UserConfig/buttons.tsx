import React, { memo } from 'react'
import { CCol, CRow } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { useUserConfigProps } from './Context.js'
import { GridConfig } from './Sections/GridConfig.js'
import { ButtonsConfig } from './Sections/ButtonsConfig.js'

export const SettingsButtonsPage = memo(function UserConfig() {
	return (
		<CRow className="split-panels">
			<CCol xl={6} className="primary-panel">
				<div className="d-flex justify-content-between">
					<div>
						<h4>Settings - Buttons</h4>
						<p>Settings apply instantaneously, don't worry about it!</p>
					</div>
				</div>
				<div style={{ marginTop: -30 }}>
					<UserConfigTable />
				</div>
			</CCol>
			{/* <CCol xs={12} xl={6} className="secondary-panel">
				<div className="secondary-panel-header">
					<h4>Remote control</h4>
					<p>Companion can be remote controlled in several ways. Below you'll find how to do it.</p>
				</div>
				<div className="secondary-panel-inner">
				</div>
			</CCol> */}
		</CRow>
	)
})

const UserConfigTable = observer(function UserConfigTable() {
	const userConfigProps = useUserConfigProps()
	if (!userConfigProps) return null

	return (
		<table className="table table-responsive-sm table-settings">
			<tbody>
				<ButtonsConfig {...userConfigProps} />
				<GridConfig {...userConfigProps} />
			</tbody>
		</table>
	)
})
