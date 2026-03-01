import React, { memo } from 'react'
import { CCol, CRow } from '@coreui/react'
import { observer } from 'mobx-react-lite'
import { useUserConfigProps } from './Context.js'
import { CompanionConfig } from './Sections/CompanionConfig.js'
import { DataCollectionConfig } from './Sections/DataCollection.js'

export const SettingsGeneralPage = memo(function UserConfig() {
	return (
		<CRow className="split-panels">
			<CCol xl={6} className="primary-panel">
				<div className="flex-column-layout">
					<div className="fixed-header">
						<div className="d-flex justify-content-between">
							<div>
								<h4>Settings - Advanced</h4>
								<p>Settings apply instantaneously, don't worry about it!</p>
							</div>
						</div>
					</div>
					<div className="scrollable-content">
						<UserConfigTable />
					</div>
				</div>
			</CCol>
		</CRow>
	)
})

const UserConfigTable = observer(function UserConfigTable() {
	const userConfigProps = useUserConfigProps()
	if (!userConfigProps) return null

	return (
		<>
			<table className="table table-responsive-sm table-settings">
				<tbody>
					<CompanionConfig {...userConfigProps} />
				</tbody>
			</table>
			<table className="table table-responsive-sm table-settings">
				<tbody>
					<DataCollectionConfig {...userConfigProps} />
				</tbody>
			</table>
		</>
	)
})
