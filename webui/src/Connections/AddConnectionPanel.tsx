import React, { useContext, useState, useCallback, useRef } from 'react'
import { CAlert, CButton, CButtonGroup } from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle, faExternalLink, faPlug, faQuestionCircle, faTimes } from '@fortawesome/free-solid-svg-icons'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { SearchBox } from '~/Components/SearchBox.js'
import { AddConnectionModal, AddConnectionModalRef } from './AddConnectionModal.js'
import { RefreshModulesList } from '~/Modules/RefreshModulesList.js'
import { LastUpdatedTimestamp } from '~/Modules/LastUpdatedTimestamp.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { useTableVisibilityHelper } from '~/Components/TableVisibility.js'
import { WindowLinkOpen } from '~/Helpers/Window.js'
import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { filterProducts, FuzzyProduct, useAllConnectionProducts } from '~/Hooks/useFilteredProducts.js'
import { Link, useNavigate } from '@tanstack/react-router'
import { makeAbsolutePath } from '~/util.js'

export const AddConnectionsPanel = observer(function AddConnectionsPanel() {
	const { modules } = useContext(RootAppStoreContext)
	const [filter, setFilter] = useState('')

	const addRef = useRef<AddConnectionModalRef>(null)
	const addConnection = useCallback((moduleInfo: FuzzyProduct) => {
		addRef.current?.show(moduleInfo)
	}, [])

	const typeFilter = useTableVisibilityHelper('connections-add-type-filter', {
		available: true,
	})

	const allProducts = useAllConnectionProducts(modules)
	const typeProducts = allProducts.filter((p) => !!p.installedInfo || typeFilter.visibility.available)

	let candidates: JSX.Element[] = []
	try {
		const searchResults = filterProducts(typeProducts, filter)

		const candidatesObj: Record<string, JSX.Element> = {}
		for (const moduleInfo of searchResults) {
			candidatesObj[moduleInfo.name] = (
				<AddConnectionEntry key={moduleInfo.name} moduleInfo={moduleInfo} addConnection={addConnection} />
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

	const navigate = useNavigate({ from: '/connections/' })
	const doConfigureConnection = useCallback(
		(connectionId: string) => {
			void navigate({ to: `/connections/${connectionId}` })
		},
		[navigate]
	)

	const doCloseAddConnections = useCallback(() => {
		void navigate({ to: '/connections' })
	}, [navigate])

	return (
		<>
			<div className="secondary-panel-simple-header">
				<h4 className="panel-title">Add New Connection</h4>
				<div className="header-buttons">
					<div className="float_right d-xl-none" onClick={doCloseAddConnections} title="Close">
						<FontAwesomeIcon icon={faTimes} size="lg" />
					</div>
				</div>
			</div>

			<div className="secondary-panel-simple-body">
				<AddConnectionModal ref={addRef} doConfigureConnection={doConfigureConnection} />
				<div style={{ clear: 'both' }} className="row-heading">
					<div className="add-connection-intro-section mb-3">
						{modules.storeList.size > 0 ? (
							<div className="intro-grid">
								<div className="intro-text">
									<p className="mb-2">
										<strong>Companion supports over {modules.storeList.size} different devices</strong> and the list
										grows every day.
									</p>
								</div>
								<div>
									<span className="text-muted">
										Can't find your device?{' '}
										<a
											target="_blank"
											href={makeAbsolutePath('/getting-started#6_modules.md')}
											className="text-decoration-none"
										>
											Check our guidance for getting device support
										</a>
									</span>
								</div>
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
									<div>
										<strong>Connect to hundreds of devices</strong> with Companion modules. Ensure you have an internet
										connection to search and install modules, or{' '}
										<a target="_blank" href="https://user.bitfocus.io/download" className="text-decoration-none">
											download a module bundle
										</a>
									</div>
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

interface AddConnectionEntryProps {
	moduleInfo: FuzzyProduct
	addConnection: (module: FuzzyProduct) => void
}

function AddConnectionEntry({ moduleInfo, addConnection }: AddConnectionEntryProps) {
	const { helpViewer } = useContext(RootAppStoreContext)

	const addConnectionClick = useCallback(() => addConnection(moduleInfo), [addConnection, moduleInfo])
	const showHelpForVersion =
		moduleInfo.installedInfo?.devVersion ??
		moduleInfo.installedInfo?.stableVersion ??
		moduleInfo.installedInfo?.betaVersion ??
		moduleInfo.installedInfo?.installedVersions?.[0] ??
		(moduleInfo.storeInfo ? { helpPath: moduleInfo.storeInfo.helpUrl, versionId: '' } : undefined)

	const showHelpClick = useCallback(
		() =>
			showHelpForVersion?.helpPath &&
			helpViewer.current?.showFromUrl(moduleInfo.id, showHelpForVersion.versionId, showHelpForVersion.helpPath),
		[helpViewer, moduleInfo.id, showHelpForVersion?.helpPath, showHelpForVersion?.versionId]
	)

	return (
		<div className="flex">
			<CButton color="primary" onClick={addConnectionClick}>
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
					<div className="m-0" onClick={showHelpClick}>
						<FontAwesomeIcon icon={faQuestionCircle} />
					</div>
				)}
			</div>
		</div>
	)
}
