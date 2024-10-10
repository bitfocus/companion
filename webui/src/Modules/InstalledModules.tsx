import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { SearchBox } from '../Components/SearchBox.js'
import { observer } from 'mobx-react-lite'
import { ModuleProductInfo, useFilteredProducts } from '../Hooks/useFilteredProducts.js'
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CCollapse } from '@coreui/react'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle, faQuestionCircle, faRectangleList } from '@fortawesome/free-solid-svg-icons'
import { HelpModal, HelpModalRef } from '../Connections/HelpModal.js'
import {
	ModuleVersionInfo,
	NewClientModuleInfo,
	NewClientModuleVersionInfo2,
} from '@companion-app/shared/Model/ModuleInfo.js'
import { socketEmitPromise } from '../util.js'
import { getModuleVersionInfoForConnection } from '../Connections/Util.js'

export const InstalledModules = observer(function InstalledModules() {
	const { socket } = useContext(RootAppStoreContext)

	const [filter, setFilter] = useState('')
	const [expandedId, setExpandedId] = useState('')
	const changeExpanded = useCallback((e: React.MouseEvent) => {
		const moduleId = e.currentTarget.getAttribute('data-module-id')
		if (!moduleId) return

		setExpandedId((oldId) => {
			if (oldId === moduleId) {
				return ''
			} else {
				return moduleId
			}
		})
	}, [])

	const helpModalRef = useRef<HelpModalRef>(null)
	const showHelpClick = useCallback((e: React.MouseEvent) => {
		const moduleId = e.currentTarget.getAttribute('data-module-id')
		if (!moduleId) return

		const versionId = e.currentTarget.getAttribute('data-version-id')
		helpModalRef.current?.show(moduleId, versionId) // TODO - this needs to pass in more data too
	}, [])

	let components: JSX.Element[] = []
	try {
		const searchResults = useFilteredProducts(filter)

		const candidatesObj: Record<string, JSX.Element> = {}
		for (const module of searchResults) {
			candidatesObj[module.baseInfo.id] = (
				<ModuleEntry
					key={module.baseInfo.id}
					module={module}
					showHelpClick={showHelpClick}
					setExpanded={changeExpanded}
					isExpanded={expandedId === module.baseInfo.id}
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

	return (
		<>
			<SearchBox filter={filter} setFilter={setFilter} />
			<HelpModal ref={helpModalRef} />

			<div className="module-manager-list">{components}</div>
		</>
	)
})

interface ModuleEntryProps {
	module: ModuleProductInfo
	showHelpClick: React.MouseEventHandler
	setExpanded: React.MouseEventHandler
	isExpanded: boolean
}

const ModuleEntry = observer(function ModuleEntry({
	module,
	showHelpClick,
	setExpanded,
	isExpanded,
}: ModuleEntryProps) {
	const { modules } = useContext(RootAppStoreContext)

	const moduleFullInfo = modules.modules.get(module.baseInfo.id)

	const defaultVersion: NewClientModuleVersionInfo2 | undefined =
		module.stableVersion ?? module.prereleaseVersion ?? module.releaseVersions[0]

	return (
		<CCard className="module-list-entry">
			<CCardHeader>
				<h4>
					<a href="#" onClick={setExpanded} data-module-id={module.baseInfo.id}>
						{module.baseInfo.name}
					</a>
					{defaultVersion?.isLegacy && (
						<>
							&nbsp;
							<FontAwesomeIcon
								icon={faExclamationTriangle}
								color="#ff6600"
								title="The current version of this module has not been updated for Companion 3.0, and may not work fully"
							/>
							&nbsp;
						</>
					)}
					{/* {moduleFullInfo && moduleFullInfo.allVersions.length > 1 && (
						<>
							&nbsp;
							<FontAwesomeIcon
								icon={faRectangleList}
								color="green"
								title="Multiple versions of this module are installed"
							/>
							&nbsp;
						</>
					)} */}
					{defaultVersion?.hasHelp && (
						<div className="float_right" onClick={showHelpClick} data-module-id={module.baseInfo.id}>
							<FontAwesomeIcon icon={faQuestionCircle} />
						</div>
					)}
				</h4>
			</CCardHeader>
			<CCollapse visible={isExpanded}>
				<CCardBody>
					{moduleFullInfo && <ModuleVersionsList moduleFullInfo={moduleFullInfo} showHelpClick={showHelpClick} />}
					{/* <p>{JSON.stringify(moduleFullInfo)}</p> */}
				</CCardBody>
			</CCollapse>
		</CCard>
	)
})

interface ModuleVersionsListProps {
	moduleFullInfo: NewClientModuleInfo
	showHelpClick: React.MouseEventHandler
}

function ModuleVersionsList({ moduleFullInfo, showHelpClick }: ModuleVersionsListProps) {
	// if (moduleFullInfo.allVersions.length <= 1) return <></>

	const devVersion: NewClientModuleVersionInfo2 | null = useMemo(() => {
		if (!moduleFullInfo.hasDevVersion) return null

		return {
			displayName: 'Dev',
			isLegacy: false,
			isDev: true,
			isBuiltin: false,
			version: {
				mode: 'custom',
				id: 'dev',
			},
			hasHelp: false,
		}
	}, [moduleFullInfo.hasDevVersion])

	return (
		<>
			<h5>Installed versions:</h5>
			<ul className="version-list">
				{devVersion && (
					<ModuleVersionRow moduleFullInfo={moduleFullInfo} version={devVersion} showHelpClick={showHelpClick} />
				)}
				{moduleFullInfo.releaseVersions.map((version, i) => (
					<ModuleVersionRow key={i} moduleFullInfo={moduleFullInfo} version={version} showHelpClick={showHelpClick} />
				))}
				{moduleFullInfo.customVersions.map((version, i) => (
					<ModuleVersionRow key={i} moduleFullInfo={moduleFullInfo} version={version} showHelpClick={showHelpClick} />
				))}
			</ul>
		</>
	)
}

interface ModuleVersionRowProps {
	moduleFullInfo: NewClientModuleInfo
	version: NewClientModuleVersionInfo2
	showHelpClick: React.MouseEventHandler
}

function ModuleVersionRow({ moduleFullInfo, version, showHelpClick }: ModuleVersionRowProps) {
	// const isStable = moduleFullInfo.stableVersion && isSameVersion(moduleFullInfo.stableVersion.version, version.version)
	// const isPrerelease =
	// 	moduleFullInfo.prereleaseVersion && isSameVersion(moduleFullInfo.prereleaseVersion.version, version.version)

	return (
		<li>
			{/* {moduleFullInfo.defaultVersion.version === version.version ? (
				<CButton color="success" size="sm" disabled>
					Current
				</CButton>
			) : (
				<CButton
					color="info"
					size="sm"
					disabled={moduleFullInfo.allVersions.length <= 1}
					onClick={activateModuleVersion}
					data-module-id={moduleFullInfo.baseInfo.id}
					data-version-id={version.version}
				>
					Activate
				</CButton>
			)}
			&nbsp; */}
			{version.displayName}
			{/* {isStable && <span className="badge badge-success">Latest Stable</span>}
			{isPrerelease && <span className="badge badge-success">Latest Prerelease</span>} */}
			{version.isLegacy && (
				<>
					&nbsp;
					<FontAwesomeIcon
						icon={faExclamationTriangle}
						color="#ff6600"
						title="The current version of this module has not been updated for Companion 3.0, and may not work fully"
					/>
					&nbsp;
				</>
			)}
			{version.hasHelp && (
				<div
					className="float_inline"
					onClick={showHelpClick}
					data-module-id={moduleFullInfo.baseInfo.id}
					data-version-id={version.version}
				>
					<FontAwesomeIcon icon={faQuestionCircle} />
				</div>
			)}
		</li>
	)
}

function isSameVersion(versionA: ModuleVersionInfo, versionB: ModuleVersionInfo) {
	return versionA.id === versionB.id && versionA.mode === versionB.mode
}
