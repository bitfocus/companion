import { CNav, CNavItem, CNavLink, CTabContent, CTabPane, CTabs } from '@coreui/react'
import { faFloppyDisk, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useState } from 'react'
import { MyErrorBoundary } from '../util.js'
import { InstalledModules } from './InstalledModules.js'
import { NavLink, useLocation } from 'react-router-dom'
import { AllModuleVersions } from './AllModuleVersions.js'
import { DiscoverVersions } from './DiscoverModules.js'

export const MODULES_MANAGER_PREFIX = '/modules'

export function ModulesManager() {
	const routerLocation = useLocation()
	let hasMatchedPane = false
	const isPaneActive = (prefix: string) => {
		// Require the path to be the same, or to be a prefix with a sub-route

		const fullPrefix = `${MODULES_MANAGER_PREFIX}/${prefix}`

		if (routerLocation.pathname.startsWith(fullPrefix + '/') || routerLocation.pathname === fullPrefix) {
			hasMatchedPane = true
			return true
		} else {
			return false
		}
	}

	const getClassForPane = (prefix: string) => {
		const paneBaseClass = 'pane-baseclass'

		if (isPaneActive(prefix)) {
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
					<CNavLink to={`${MODULES_MANAGER_PREFIX}/all-installed`} as={NavLink}>
						<FontAwesomeIcon icon={faFloppyDisk} /> All Installed?
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink to={`${MODULES_MANAGER_PREFIX}/all-versions`} as={NavLink}>
						<FontAwesomeIcon icon={faFloppyDisk} /> All version?
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink to={`${MODULES_MANAGER_PREFIX}/discover`} as={NavLink}>
						<FontAwesomeIcon icon={faMagnifyingGlass} /> Discover
					</CNavLink>
				</CNavItem>
			</CNav>
			<CTabContent>
				<CTabPane className={getClassForPane('all-installed')}>
					<MyErrorBoundary>
						<InstalledModules />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane className={getClassForPane('all-versions')}>
					<MyErrorBoundary>
						<AllModuleVersions />
					</MyErrorBoundary>
				</CTabPane>
				{isPaneActive('discover') && (
					// Only load the discover pane if it's active, to avoid loading the subscriptions
					<CTabPane className={getClassForPane('discover')}>
						<MyErrorBoundary>
							<DiscoverVersions />
						</MyErrorBoundary>
					</CTabPane>
				)}
			</CTabContent>
		</>
	)
}
