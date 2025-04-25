import React, { useCallback, useContext, useState } from 'react'
import { CAlert, CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEyeSlash, faPlug, faQuestionCircle, faWarning } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '../Components/NonIdealState.js'
import { SearchBox } from '../Components/SearchBox.js'
import { useAllConnectionProducts, filterProducts, FuzzyProduct } from '../Hooks/useFilteredProducts.js'
import { ImportModules } from './ImportCustomModule.js'
import { useTableVisibilityHelper, VisibilityButton } from '../Components/TableVisibility.js'
import { RefreshModulesList } from './RefreshModulesList.js'
import { LastUpdatedTimestamp } from './LastUpdatedTimestamp.js'

interface VisibleModulesState {
	installed: boolean
	available: boolean
	availableDeprecated: boolean
}

interface ModulesListProps {
	doManageModule: (connectionId: string | null) => void
	selectedModuleId: string | null
}

export const ModulesList = observer(function ModulesList({ doManageModule, selectedModuleId }: ModulesListProps) {
	const { modules } = useContext(RootAppStoreContext)

	const visibleModules = useTableVisibilityHelper<VisibleModulesState>('modules_visible', {
		installed: true,
		available: false,
		availableDeprecated: false,
	})

	const [filter, setFilter] = useState('')

	const allProducts = useAllConnectionProducts(modules, true)
	const typeProducts = allProducts.filter((p) => {
		let isVisible = false
		if (p.installedInfo) {
			if (
				(p.installedInfo.installedVersions.length > 0 || p.installedInfo.devVersion) &&
				visibleModules.visibility.installed
			)
				isVisible = true
		}
		if (
			p.storeInfo &&
			visibleModules.visibility.available &&
			(visibleModules.visibility.availableDeprecated || !p.storeInfo.deprecationReason) // only show deprecated ones when the flag is enabled
		)
			isVisible = true

		return isVisible
	})

	const includeStoreModules = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			visibleModules.toggleVisibility('available', true)
		},
		[visibleModules]
	)

	let components: JSX.Element[] = []
	try {
		const searchResults = filterProducts(typeProducts, filter)

		const candidatesObj: Record<string, JSX.Element> = {}
		for (const moduleInfo of searchResults) {
			candidatesObj[moduleInfo.id] = (
				<ModulesListRow
					key={moduleInfo.id}
					id={moduleInfo.id}
					moduleInfo={moduleInfo}
					doManageModule={doManageModule}
					isSelected={moduleInfo.id === selectedModuleId}
				/>
			)
		}

		if (!filter) {
			components = Object.entries(candidatesObj)
				.sort((a, b) => {
					const aName = a[0].toLocaleLowerCase()
					const bName = b[0].toLocaleLowerCase()
					if (aName < bName) return -1
					if (aName > bName) return 1
					return 0
				})
				.map((c) => c[1])
		} else {
			components = Object.entries(candidatesObj).map((c) => c[1])
		}
	} catch (e) {
		console.error('Failed to compile candidates list:', e)

		components = []
		components.push(
			<CAlert color="warning" role="alert">
				Failed to build list of modules:
				<br />
				{e?.toString()}
			</CAlert>
		)
	}

	const hiddenCount = new Set(allProducts.map((p) => p.id)).size - new Set(typeProducts.map((p) => p.id)).size

	return (
		<div>
			<h4>Manage Modules</h4>

			<p>
				Here you can view and manage the modules you have installed.
				<br />
				If you have an active internet connection, you can search for and install modules to support additional devices.
				If you can't find the device you're looking for, please{' '}
				<a target="_blank" href="https://github.com/bitfocus/companion-module-requests">
					add a request
				</a>{' '}
				on GitHub
			</p>

			<CAlert color="info">
				The module system is currently in development.
				<br />
				You can get the latest offline module bundle from{' '}
				<a href="https://codeload.github.com/bitfocus/companion-bundled-modules/tar.gz/refs/heads/main" target="_blank">
					GitHub here
				</a>
			</CAlert>

			<ImportModules />

			<div className="refresh-and-last-updated">
				<RefreshModulesList />
				<LastUpdatedTimestamp timestamp={modules.storeUpdateInfo.lastUpdated} />
			</div>

			<SearchBox filter={filter} setFilter={setFilter} />

			<table className="table-tight table-responsive-sm">
				<thead>
					<tr>
						<th colSpan={2}>
							Module
							<CButtonGroup className="table-header-buttons">
								<VisibilityButton {...visibleModules} keyId="installed" color="success" label="Installed" />
								<VisibilityButton {...visibleModules} keyId="available" color="warning" label="Available" />
								<VisibilityButton {...visibleModules} keyId="availableDeprecated" color="primary" label="Deprecated" />
							</CButtonGroup>
						</th>
					</tr>
				</thead>
				<tbody>
					{components}
					{hiddenCount > 0 && (
						<tr>
							<td colSpan={4} style={{ padding: '10px 5px' }}>
								<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'red' }} />
								<strong>{hiddenCount} Modules are ignored</strong>
							</td>
						</tr>
					)}

					{modules.modules.size === 0 && !visibleModules.visibility.available && (
						<tr>
							<td colSpan={4}>
								<NonIdealState icon={faPlug}>
									You don't have any modules installed yet. <br />
									Try adding something from the list <span className="d-xl-none">below</span>
									<span className="d-none d-xl-inline">to the right</span>.
								</NonIdealState>
							</td>
						</tr>
					)}

					{components.length === 0 && allProducts.length > 0 && !!filter && !visibleModules.visibility.available && (
						<tr>
							<td colSpan={4}>
								<NonIdealState icon={faPlug}>
									No modules match your search.
									<br />
									{!visibleModules.visibility.available && (
										<a href="#" onClick={includeStoreModules}>
											Click here to include modules from the store
										</a>
									)}
								</NonIdealState>
							</td>
						</tr>
					)}
				</tbody>
			</table>
		</div>
	)
})

interface ModulesListRowProps {
	id: string
	moduleInfo: FuzzyProduct
	doManageModule: (moduleId: string | null) => void
	isSelected: boolean
}

const ModulesListRow = observer(function ModulesListRow({
	id,
	moduleInfo,
	doManageModule,
	isSelected,
}: ModulesListRowProps) {
	const { helpViewer } = useContext(RootAppStoreContext)

	const doShowHelp = useCallback(() => {
		if (!moduleInfo.helpUrl) return
		const latestVersionName =
			moduleInfo.installedInfo?.stableVersion?.versionId ?? moduleInfo.installedInfo?.betaVersion?.versionId ?? ''
		helpViewer.current?.showFromUrl(id, latestVersionName, moduleInfo.helpUrl)
	}, [helpViewer, id, moduleInfo])

	const doEdit = () => {
		if (!moduleInfo) {
			return
		}

		doManageModule(id)
	}

	// const openBugUrl = useCallback(() => {
	// 	const url = moduleInfo?.bugUrl
	// 	if (url) windowLinkOpen({ href: url })
	// }, [moduleInfo])

	// const moduleVersion = getModuleVersionInfoForConnection(moduleInfo, connection)

	return (
		<tr
			className={classNames({
				'connectionlist-selected': isSelected,
			})}
		>
			<td onClick={doEdit} className="hand">
				{!!moduleInfo.storeInfo?.deprecationReason && <FontAwesomeIcon icon={faWarning} title="Deprecated" />}

				{moduleInfo.name}

				{/* {moduleInfo.installedVersions.?.isLegacy && (
					<>
						<FontAwesomeIcon
							icon={faExclamationTriangle}
							color="#f80"
							title="This module has not been updated for Companion 3.0, and may not work fully"
						/>{' '}
					</>
				)}
				{moduleVersion?.displayName} */}
			</td>
			<td className="compact">
				<CButton
					onMouseDown={doShowHelp}
					color="white"
					title="Show Help"
					disabled={!moduleInfo.helpUrl}
					style={{ textAlign: 'left' }}
				>
					<FontAwesomeIcon icon={faQuestionCircle} />
				</CButton>
			</td>
		</tr>
	)
})
