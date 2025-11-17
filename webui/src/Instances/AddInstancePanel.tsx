import React, { useContext, useState, useCallback, useRef } from 'react'
import { CAlert, CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faCog,
	faExclamationTriangle,
	faExternalLink,
	faPlug,
	faQuestionCircle,
	faTimes,
} from '@fortawesome/free-solid-svg-icons'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { SearchBox } from '~/Components/SearchBox.js'
import { AddInstanceModal, type AddInstanceModalRef } from './AddInstanceModal.js'
import { RefreshModulesList } from '~/Modules/RefreshModulesList.js'
import { LastUpdatedTimestamp } from '~/Modules/LastUpdatedTimestamp.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { useTableVisibilityHelper } from '~/Components/TableVisibility.js'
import { WindowLinkOpen } from '~/Helpers/Window.js'
import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { filterProducts, useAllModuleProducts, type FuzzyProduct } from '~/Hooks/useFilteredProducts.js'
import { Link } from '@tanstack/react-router'
import type { AddInstanceService } from './AddInstanceService.js'

interface AddInstancePanelProps {
	service: AddInstanceService

	title: string
	description: (storeCount: number) => React.ReactNode
}

export const AddInstancePanel = observer(function AddInstancePanel({
	service,
	title,
	description,
}: AddInstancePanelProps) {
	const { modules } = useContext(RootAppStoreContext)

	const [filter, setFilter] = useState('')

	const addRef = useRef<AddInstanceModalRef>(null)
	const addInstance = useCallback((moduleInfo: FuzzyProduct) => {
		addRef.current?.show(moduleInfo)
	}, [])

	const typeFilter = useTableVisibilityHelper(`${service.moduleType}-add-type-filter`, {
		available: true,
	})

	const storeModulesOfTypeCount = modules.countStoreModulesOfType(service.moduleType)

	const allProducts = useAllModuleProducts(service.moduleType)
	const typeProducts = allProducts.filter(
		(p) => storeModulesOfTypeCount === 0 || !!p.installedInfo || typeFilter.visibility.available
	)

	let candidates: JSX.Element[] = []
	try {
		const searchResults = filterProducts(typeProducts, filter, false)

		const candidatesObj: Record<string, JSX.Element> = {}
		for (const moduleInfo of searchResults) {
			candidatesObj[moduleInfo.name] = (
				<AddInstanceEntry key={moduleInfo.name} moduleInfo={moduleInfo} addInstance={addInstance} />
			)
		}

		if (!filter) {
			candidates = Object.entries(candidatesObj)
				.sort((a, b) => {
					const aName = a[0].toLocaleLowerCase()
					const bName = b[0].toLocaleLowerCase()
					if (aName < bName) return -1
					if (aName > bName) return 1
					return 0
				})
				.map((c) => c[1])
		} else {
			candidates = Object.entries(candidatesObj).map((c) => c[1])
		}
	} catch (e) {
		console.error('Failed to compile candidates list:', e)

		candidates = []
		candidates.push(
			<CAlert color="warning" role="alert">
				Failed to build list of modules:
				<br />
				{e?.toString()}
			</CAlert>
		)
	}

	const includeStoreModules = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			typeFilter.toggleVisibility('available', true)
		},
		[typeFilter]
	)

	return (
		<>
			<div className="secondary-panel-simple-header">
				<h4 className="panel-title">{title}</h4>
				<div className="header-buttons">
					<div className="float_right d-xl-none" onClick={service.closeAddInstance} title="Close">
						<FontAwesomeIcon icon={faTimes} size="lg" />
					</div>
				</div>
			</div>

			<div className="secondary-panel-simple-body">
				<AddInstanceModal ref={addRef} service={service} openConfigureInstance={service.openConfigureInstance} />
				<div style={{ clear: 'both' }} className="row-heading">
					<div className="add-connection-intro-section mb-3">
						{storeModulesOfTypeCount > 0 ? (
							<div className="intro-grid">
								{description(storeModulesOfTypeCount)}
								<div className="intro-filter">
									<CButtonGroup role="group" aria-label="Module visibility filter">
										<CButton
											size="sm"
											color={!typeFilter.visibility.available ? 'info' : 'outline-info'}
											onClick={() => typeFilter.toggleVisibility('available')}
											disabled={!typeFilter.visibility.available}
										>
											Installed Only
										</CButton>
										<CButton
											size="sm"
											color={typeFilter.visibility.available ? 'info' : 'outline-info'}
											onClick={() => typeFilter.toggleVisibility('available')}
											disabled={typeFilter.visibility.available}
										>
											All Available
										</CButton>
									</CButtonGroup>
								</div>
							</div>
						) : (
							<CAlert color="info" className="mb-0">
								<div className="d-flex align-items-center gap-2">
									<FontAwesomeIcon icon={faPlug} className="text-info" />
									{description(0)}
								</div>
							</CAlert>
						)}
					</div>

					<div>
						<div className="refresh-and-last-updated mb-3">
							<RefreshModulesList btnSize="sm" />
							<LastUpdatedTimestamp timestamp={modules.storeUpdateInfo.lastUpdated} />
						</div>

						<SearchBox filter={filter} setFilter={setFilter} />
					</div>
				</div>
				<div id="connection_add_search_results">
					{candidates}

					{candidates.length === 0 && allProducts.length > 0 && (
						<NonIdealState icon={faPlug}>
							No modules match your search.
							<br />
							{!typeFilter.visibility.available && (
								<a href="#" onClick={includeStoreModules}>
									Click here to include modules from the store
								</a>
							)}
						</NonIdealState>
					)}

					{candidates.length === 0 && allProducts.length === 0 && (
						<NonIdealState icon={faPlug}>
							No modules are installed.
							<br />
							Make sure you have an active internet connection, or load a module bundle into the{' '}
							<Link to="/modules">Modules tab</Link>
						</NonIdealState>
					)}
				</div>
			</div>
		</>
	)
})

interface AddInstanceEntryProps {
	moduleInfo: FuzzyProduct
	addInstance: (module: FuzzyProduct) => void
}

function AddInstanceEntry({ moduleInfo, addInstance }: AddInstanceEntryProps) {
	const { helpViewer } = useContext(RootAppStoreContext)

	const addInstanceClick = useCallback(() => addInstance(moduleInfo), [addInstance, moduleInfo])
	const showHelpForVersion =
		moduleInfo.installedInfo?.devVersion ??
		moduleInfo.installedInfo?.stableVersion ??
		moduleInfo.installedInfo?.betaVersion ??
		moduleInfo.installedInfo?.builtinVersion ??
		moduleInfo.installedInfo?.installedVersions?.[0] ??
		(moduleInfo.storeInfo ? { helpPath: moduleInfo.storeInfo.helpUrl, versionId: '' } : undefined)

	const showHelpClick = useCallback(
		() =>
			showHelpForVersion?.helpPath &&
			helpViewer.current?.showFromUrl(
				moduleInfo.moduleType,
				moduleInfo.moduleId,
				showHelpForVersion.versionId,
				showHelpForVersion.helpPath
			),
		[
			helpViewer,
			moduleInfo.moduleType,
			moduleInfo.moduleId,
			showHelpForVersion?.helpPath,
			showHelpForVersion?.versionId,
		]
	)

	return (
		<div className="flex">
			<CButton color="primary" onClick={addInstanceClick}>
				Add
			</CButton>
			&nbsp;
			{moduleInfo.installedInfo?.stableVersion?.isLegacy && (
				<>
					<FontAwesomeIcon
						icon={faExclamationTriangle}
						color="#ff6600"
						size={'xl'}
						title="This module has not been updated for Companion 3.0, and may not work fully"
					/>
					&nbsp;
				</>
			)}
			<div className="grow" style={{ alignContent: 'center' }}>
				{moduleInfo.name}
			</div>
			<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
				<Link
					to={`/modules/$moduleType/$moduleId`}
					params={{ moduleType: moduleInfo.moduleType, moduleId: moduleInfo.moduleId }}
					className="text-decoration-none"
				>
					<div
						className="m-0"
						style={{ display: 'inline-block', color: 'var(--cui-body-color)' }}
						title={'Manage module'}
					>
						<FontAwesomeIcon icon={faCog} />
					</div>
				</Link>
				{!!moduleInfo.storeInfo && (
					<WindowLinkOpen className="m-0" title="Open Store Page" href={moduleInfo.storeInfo.storeUrl}>
						<FontAwesomeIcon icon={faExternalLink} />
					</WindowLinkOpen>
				)}
				{!!moduleInfo.storeInfo?.githubUrl && (
					<WindowLinkOpen className="m-0" title="Open GitHub Page" href={moduleInfo.storeInfo.githubUrl}>
						<FontAwesomeIcon icon={faGithub} />
					</WindowLinkOpen>
				)}
				{showHelpForVersion?.helpPath && (
					<div className="m-0" style={{ cursor: 'pointer' }} onClick={showHelpClick}>
						<FontAwesomeIcon icon={faQuestionCircle} />
					</div>
				)}
			</div>
		</div>
	)
}
