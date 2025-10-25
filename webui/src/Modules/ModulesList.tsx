import React, { useCallback, useContext, useState } from 'react'
import { CAlert, CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEyeSlash, faPlug, faQuestionCircle, faWarning } from '@fortawesome/free-solid-svg-icons'
import classNames from 'classnames'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SearchBox } from '~/Components/SearchBox.js'
import { useAllModuleProducts, filterProducts, type FuzzyProduct } from '~/Hooks/useFilteredProducts.js'
import { ImportModules } from './ImportCustomModule.js'
import { useTableVisibilityHelper, VisibilityButton } from '~/Components/TableVisibility.js'
import { RefreshModulesList } from './RefreshModulesList.js'
import { LastUpdatedTimestamp } from './LastUpdatedTimestamp.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'

interface VisibleModulesState {
	installed: boolean
	available: boolean
	availableDeprecated: boolean
}

interface ModulesListProps {
	doManageModule: (moduleInfo: ModuleTypeAndIdPair | null) => void
	selectedModuleInfo: ModuleTypeAndIdPair | null
}

export interface ModuleTypeAndIdPair {
	moduleType: ModuleInstanceType
	moduleId: string
}

export const ModulesList = observer(function ModulesList({ doManageModule, selectedModuleInfo }: ModulesListProps) {
	const { modules } = useContext(RootAppStoreContext)

	const visibleModules = useTableVisibilityHelper<VisibleModulesState>('modules_visible', {
		installed: true,
		available: false,
		availableDeprecated: false,
	})

	const [filter, setFilter] = useState('')

	const allProducts = useAllModuleProducts(null, true, true)
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
			candidatesObj[moduleInfo.moduleId] = (
				<ModulesListRow
					key={moduleInfo.moduleId}
					moduleInfo={moduleInfo}
					doManageModule={doManageModule}
					isSelected={
						!!selectedModuleInfo &&
						moduleInfo.moduleId === selectedModuleInfo.moduleId &&
						moduleInfo.moduleType === selectedModuleInfo.moduleType
					}
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

	const hiddenCount =
		new Set(allProducts.map((p) => p.moduleId)).size - new Set(typeProducts.map((p) => p.moduleId)).size

	return (
		<div className="flex-column-layout">
			<div className="fixed-header">
				<h4>Manage Modules</h4>

				<p>
					View and manage your installed modules, or search for new ones to support additional devices. Can't find your
					device?{' '}
					<a target="_blank" href={makeAbsolutePath('/getting-started#6_modules.md')} className="text-decoration-none">
						Check our guidance for getting device support
					</a>
					.<br />
					For offline systems, download module bundles from the{' '}
					<a href="https://user.bitfocus.io/download" target="_blank" className="text-decoration-none">
						Bitfocus website
					</a>
					.
				</p>

				<ImportModules />

				<div className="refresh-and-last-updated">
					<RefreshModulesList />
					<LastUpdatedTimestamp timestamp={modules.storeUpdateInfo.lastUpdated} />
				</div>

				<SearchBox filter={filter} setFilter={setFilter} />
			</div>

			<div className="scrollable-content">
				<table className="table-tight table-responsive-sm">
					<thead>
						<tr>
							<th colSpan={2}>
								Module
								<CButtonGroup className="table-header-buttons">
									<VisibilityButton {...visibleModules} keyId="installed" color="success" label="Installed" />
									<VisibilityButton {...visibleModules} keyId="available" color="warning" label="Available" />
									<VisibilityButton
										{...visibleModules}
										keyId="availableDeprecated"
										color="primary"
										label="Deprecated"
									/>
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

						{modules.count === 0 && !visibleModules.visibility.available && (
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
		</div>
	)
})

interface ModulesListRowProps {
	moduleInfo: FuzzyProduct
	doManageModule: (moduleInfo: ModuleTypeAndIdPair | null) => void
	isSelected: boolean
}

const ModulesListRow = observer(function ModulesListRow({
	moduleInfo,
	doManageModule,
	isSelected,
}: ModulesListRowProps) {
	const { helpViewer } = useContext(RootAppStoreContext)

	const doShowHelp = useCallback(() => {
		if (!moduleInfo.helpUrl) return
		const latestVersionName =
			moduleInfo.installedInfo?.stableVersion?.versionId ?? moduleInfo.installedInfo?.betaVersion?.versionId ?? ''
		helpViewer.current?.showFromUrl(moduleInfo.moduleType, moduleInfo.moduleId, latestVersionName, moduleInfo.helpUrl)
	}, [helpViewer, moduleInfo])

	const doEdit = () => {
		if (!moduleInfo) {
			return
		}

		doManageModule({ moduleId: moduleInfo.moduleId, moduleType: moduleInfo.moduleType })
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
