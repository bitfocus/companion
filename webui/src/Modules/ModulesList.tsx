import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CAlert, CButton, CButtonGroup, CPopover } from '@coreui/react'
import { ConnectionsContext } from '../util.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEyeSlash, faQuestionCircle, faBug, faEllipsisV, faPlug } from '@fortawesome/free-solid-svg-icons'
import { windowLinkOpen } from '../Helpers/Window.js'
import classNames from 'classnames'
import type { ClientConnectionConfig } from '@companion-app/shared/Model/Common.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '../Components/NonIdealState.js'
import { Tuck } from '../Components/Tuck.js'
import { NewClientModuleVersionInfo2 } from '@companion-app/shared/Model/ModuleInfo.js'
import { SearchBox } from '../Components/SearchBox.js'
import { ModuleProductInfo, useFilteredProducts } from '../Hooks/useFilteredProducts.js'
import { ImportCustomModule } from './ImportCustomModule.js'
import { useTableVisibilityHelper, VisibilityButton } from '../Components/TableVisibility.js'

interface VisibleModulesState {
	dev: boolean
	builtin: boolean
	store: boolean
}

interface ModulesListProps {
	showHelp: (connectionId: string, moduleVersion: NewClientModuleVersionInfo2) => void
	doManageModule: (connectionId: string | null) => void
	selectedModuleId: string | null
}

export const ModulesList = observer(function ModulesList({
	showHelp,
	doManageModule,
	selectedModuleId,
}: ModulesListProps) {
	const { modules } = useContext(RootAppStoreContext)
	const connectionsContext = useContext(ConnectionsContext)

	const connectionsRef = useRef<Record<string, ClientConnectionConfig>>()
	useEffect(() => {
		connectionsRef.current = connectionsContext
	}, [connectionsContext])

	const visibleModules = useTableVisibilityHelper<VisibleModulesState>('modules_visible', {
		dev: true,
		builtin: true,
		store: true,
	})

	const [filter, setFilter] = useState('')

	let components: JSX.Element[] = []
	try {
		const searchResults = useFilteredProducts(filter)

		const candidatesObj: Record<string, JSX.Element> = {}
		for (const moduleInfo of searchResults) {
			let isVisible = false
			if (moduleInfo.hasDevVersion && visibleModules.visiblity.dev) isVisible = true

			const [hasBuiltin, hasStore] = moduleInfo.installedVersions.reduce(
				([builtin, release], v) => {
					if (v.isBuiltin) return [true, release]
					if (!v.isBuiltin) return [builtin, true]
					return [builtin, release]
				},
				[false, false]
			)
			if (hasBuiltin && visibleModules.visiblity.builtin) isVisible = true
			if (hasStore && visibleModules.visiblity.store) isVisible = true

			if (!isVisible) continue

			candidatesObj[moduleInfo.baseInfo.id] = (
				<ModulesListRow
					key={moduleInfo.baseInfo.id}
					id={moduleInfo.baseInfo.id}
					moduleInfo={moduleInfo}
					showHelp={showHelp}
					doManageModule={doManageModule}
					isSelected={moduleInfo.baseInfo.id === selectedModuleId}
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

	const hiddenCount = modules.modules.size - components.length

	return (
		<div>
			<h4>Manage Modules</h4>

			<p>Here you can view and manage the modules you have installed.</p>

			<ImportCustomModule />

			<SearchBox filter={filter} setFilter={setFilter} />

			<table className="table-tight table-responsive-sm">
				<thead>
					<tr>
						<th>Module</th>
						<th colSpan={3} className="fit">
							<CButtonGroup className="table-header-buttons">
								<VisibilityButton {...visibleModules} keyId="dev" color="secondary" label="Dev" />
								<VisibilityButton {...visibleModules} keyId="builtin" color="success" label="Builtin" />
								<VisibilityButton {...visibleModules} keyId="store" color="warning" label="Store" />
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
								<strong>{hiddenCount} Modules are hidden</strong>
							</td>
						</tr>
					)}
					{modules.modules.size === 0 && (
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
				</tbody>
			</table>
		</div>
	)
})

interface ModulesListRowProps {
	id: string
	moduleInfo: ModuleProductInfo
	showHelp: (connectionId: string, moduleVersion: NewClientModuleVersionInfo2) => void
	doManageModule: (moduleId: string | null) => void
	isSelected: boolean
}

const ModulesListRow = observer(function ModulesListRow({
	id,
	moduleInfo,
	showHelp,
	doManageModule,
	isSelected,
}: ModulesListRowProps) {
	const doShowHelp = useCallback(() => {
		// moduleVersion?.hasHelp && showHelp(connection.instance_type, moduleVersion),
	}, [showHelp, id])

	const doEdit = () => {
		if (!moduleInfo) {
			return
		}

		doManageModule(id)
	}

	const openBugUrl = useCallback(() => {
		const url = moduleInfo?.baseInfo?.bugUrl
		if (url) windowLinkOpen({ href: url })
	}, [moduleInfo])

	// const moduleVersion = getModuleVersionInfoForConnection(moduleInfo, connection)

	return (
		<tr
			className={classNames({
				'connectionlist-selected': isSelected,
			})}
		>
			<td onClick={doEdit} className="hand">
				{moduleInfo.baseInfo.name ?? ''}

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
			<td className="action-buttons">
				<div style={{ display: 'flex' }}>
					<CPopover
						trigger="focus"
						placement="right"
						style={{ backgroundColor: 'white' }}
						content={
							<>
								{/* Note: the popover closing due to focus loss stops mouseup/click events propogating */}
								<CButtonGroup vertical>
									<CButton
										onMouseDown={doShowHelp}
										color="secondary"
										title="Help"
										// disabled={!moduleVersion?.hasHelp}
										style={{ textAlign: 'left' }}
									>
										<Tuck>
											<FontAwesomeIcon icon={faQuestionCircle} />
										</Tuck>
										Help
									</CButton>

									<CButton
										onMouseDown={openBugUrl}
										color="secondary"
										title="Issue Tracker"
										disabled={!moduleInfo?.baseInfo?.bugUrl}
										style={{ textAlign: 'left' }}
									>
										<Tuck>
											<FontAwesomeIcon icon={faBug} />
										</Tuck>
										Known issues
									</CButton>
								</CButtonGroup>
							</>
						}
					>
						<CButton color="secondary" style={{ padding: '3px 16px' }} onClick={(e) => e.currentTarget.focus()}>
							<FontAwesomeIcon icon={faEllipsisV} />
						</CButton>
					</CPopover>
				</div>
			</td>
		</tr>
	)
})
