import React, { memo } from 'react'
import { CCol, CRow } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { useUserConfigProps } from './Context.js'
import { SurfacesConfig } from './Sections/SurfacesConfig.js'
import { PinLockoutConfig } from './Sections/PinLockoutConfig.js'

export const SettingsSurfacesPage = memo(function UserConfig() {
	return (
		<CRow className="split-panels">
			<CCol xl={6} className="primary-panel">
				<div className="flex-column-layout">
					<div className="fixed-header">
						<div className="d-flex justify-content-between">
							<div>
								<h4>Settings - Surfaces</h4>
								<p>Settings apply instantaneously, don't worry about it!</p>
							</div>
						</div>
					</div>
					<div className="scrollable-content">
						<UserConfigTable />
					</div>
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

export const UserConfigTable = observer(function UserConfigTable() {
	const userConfigProps = useUserConfigProps()
	if (!userConfigProps) return null

	return (
		<table className="table table-responsive-sm table-settings">
			<tbody>
				<SurfacesConfig {...userConfigProps} />
				<PinLockoutConfig {...userConfigProps} />
			</tbody>
		</table>
	)
})
