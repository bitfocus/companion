import React, { useCallback } from 'react'
import {
	CTable,
	CTableHead,
	CTableRow,
	CTableHeaderCell,
	CTableBody,
	CTableDataCell,
	CButton,
	CButtonGroup,
} from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog, faTrash, faToggleOff, faToggleOn } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { ClientSurfaceInstanceConfigWithId } from './SurfaceModulesList.js'

interface SurfaceInstancesTableProps {
	modules: ClientSurfaceInstanceConfigWithId[]
	selectedModuleId: string | null
	doConfigureModule: (moduleId: string | null) => void
	doAskDelete: (moduleId: string) => void
}

export const SurfaceInstancesTable = observer(function SurfaceInstancesTable({
	modules,
	selectedModuleId,
	doConfigureModule,
	doAskDelete,
}: SurfaceInstancesTableProps) {
	const toggleModule = useCallback((moduleId: string, enabled: boolean) => {
		// TODO: Implement toggle enable/disable
		console.log('Toggle module', moduleId, enabled)
	}, [])

	return (
		<CTable striped responsive className="surface-instances-table">
			<CTableHead>
				<CTableRow>
					<CTableHeaderCell>Name</CTableHeaderCell>
					<CTableHeaderCell>Module</CTableHeaderCell>
					<CTableHeaderCell>Version</CTableHeaderCell>
					<CTableHeaderCell>Status</CTableHeaderCell>
					<CTableHeaderCell>Actions</CTableHeaderCell>
				</CTableRow>
			</CTableHead>
			<CTableBody>
				{modules.map((module) => (
					<CTableRow
						key={module.id}
						className={selectedModuleId === module.id ? 'table-active' : ''}
						onClick={() => doConfigureModule(module.id)}
						style={{ cursor: 'pointer' }}
					>
						<CTableDataCell>
							<strong>{module.label}</strong>
						</CTableDataCell>
						<CTableDataCell>{module.moduleId}</CTableDataCell>
						<CTableDataCell>{module.moduleVersionId || 'Latest'}</CTableDataCell>
						<CTableDataCell>
							<span className={`badge ${module.enabled ? 'bg-success' : 'bg-secondary'}`}>
								{module.enabled ? 'Enabled' : 'Disabled'}
							</span>
						</CTableDataCell>
						<CTableDataCell onClick={(e) => e.stopPropagation()}>
							<CButtonGroup>
								<CButton
									size="sm"
									color="primary"
									variant="outline"
									title="Configure"
									onClick={() => doConfigureModule(module.id)}
								>
									<FontAwesomeIcon icon={faCog} />
								</CButton>
								<CButton
									size="sm"
									color={module.enabled ? 'warning' : 'success'}
									variant="outline"
									title={module.enabled ? 'Disable' : 'Enable'}
									onClick={() => toggleModule(module.id, !module.enabled)}
								>
									<FontAwesomeIcon icon={module.enabled ? faToggleOff : faToggleOn} />
								</CButton>
								<CButton
									size="sm"
									color="danger"
									variant="outline"
									title="Delete"
									onClick={() => doAskDelete(module.id)}
								>
									<FontAwesomeIcon icon={faTrash} />
								</CButton>
							</CButtonGroup>
						</CTableDataCell>
					</CTableRow>
				))}
			</CTableBody>
		</CTable>
	)
})
