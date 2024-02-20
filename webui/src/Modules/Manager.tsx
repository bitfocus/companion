import { CNav, CNavItem, CNavLink, CTabContent, CTabPane, CTabs } from '@coreui/react'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { MyErrorBoundary } from '../util.js'
import { InstalledModules } from './InstalledModules.js'

export function ModulesManager() {
	return (
		<>
			<h4>Manage Modules</h4>
			<p>Here you can view and manage the modules you have installed.</p>

			<CTabs activeTab="installed">
				<CNav variant="tabs">
					<CNavItem>
						<CNavLink data-tab="installed">
							<FontAwesomeIcon icon={faFloppyDisk} /> Installed
						</CNavLink>
					</CNavItem>
				</CNav>
				<CTabContent fade={false}>
					<CTabPane data-tab="installed">
						<MyErrorBoundary>
							<InstalledModules />
						</MyErrorBoundary>
					</CTabPane>
				</CTabContent>
			</CTabs>
		</>
	)
}
