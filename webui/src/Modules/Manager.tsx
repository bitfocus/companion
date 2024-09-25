import { CNav, CNavItem, CNavLink, CTabContent, CTabPane, CTabs } from '@coreui/react'
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useState } from 'react'
import { MyErrorBoundary } from '../util.js'
import { InstalledModules } from './InstalledModules.js'
import { NavLink, useLocation } from 'react-router-dom'

export const MODULES_MANAGER_PREFIX = '/modules'

export function ModulesManager() {
	const routerLocation = useLocation()
	let hasMatchedPane = false
	const getClassForPane = (prefix: string) => {
		// Require the path to be the same, or to be a prefix with a sub-route

		const paneBaseClass = 'pane-baseclass'

		const fullPrefix = `${MODULES_MANAGER_PREFIX}/${prefix}`

		if (routerLocation.pathname.startsWith(fullPrefix + '/') || routerLocation.pathname === fullPrefix) {
			hasMatchedPane = true
			return paneBaseClass + ' active show'
		} else {
			return paneBaseClass
		}
	}

	return (
		<>
			<h4>Manage Modules</h4>
			<p>Here you can view and manage the modules you have installed.</p>

			<CNav variant="tabs">
				<CNavItem>
					<CNavLink to={`${MODULES_MANAGER_PREFIX}/installed`} as={NavLink}>
						<FontAwesomeIcon icon={faFloppyDisk} /> Installed
					</CNavLink>
				</CNavItem>
			</CNav>
			<CTabContent>
				<CTabPane className={getClassForPane('installed')}>
					<MyErrorBoundary>
						<InstalledModules />
					</MyErrorBoundary>
				</CTabPane>
			</CTabContent>
		</>
	)
}
