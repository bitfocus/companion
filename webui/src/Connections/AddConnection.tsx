import React, { useContext, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import {
	CAlert,
	CButton,
	CCol,
	CForm,
	CFormInput,
	CFormLabel,
	CFormSelect,
	CModalBody,
	CModalFooter,
	CModalHeader,
} from '@coreui/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { ConnectionsContext, PreventDefaultHandler, socketEmitPromise } from '../util.js'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { SearchBox } from '../Components/SearchBox.js'
import { ModuleProductInfo, useFilteredProducts } from '../Hooks/useFilteredProducts.js'
import { CModalExt } from '../Components/CModalExt.js'
import {
	ModuleVersionInfo,
	NewClientModuleInfo,
	NewClientModuleVersionInfo2,
} from '@companion-app/shared/Model/ModuleInfo.js'
import { makeLabelSafe } from '@companion-app/shared/Label.js'
import { ClientConnectionConfig } from '@companion-app/shared/Model/Common.js'
import { getModuleVersionInfoForConnection } from './Util.js'

interface AddConnectionsPanelProps {
	showHelp: (moduleId: string, moduleVersion: NewClientModuleVersionInfo2) => void
	doConfigureConnection: (connectionId: string) => void
}

export const AddConnectionsPanel = observer(function AddConnectionsPanel({
	showHelp,
	doConfigureConnection,
}: AddConnectionsPanelProps) {
	const { modules } = useContext(RootAppStoreContext)
	const [filter, setFilter] = useState('')

	const addRef = useRef<AddConnectionModalRef>(null)
	const addConnection = useCallback((module: ModuleProductInfo) => {
		addRef.current?.show(module)
	}, [])

	let candidates: JSX.Element[] = []
	try {
		const searchResults = useFilteredProducts(filter)

		const candidatesObj: Record<string, JSX.Element> = {}
		for (const module of searchResults) {
			candidatesObj[module.baseInfo.name] = (
				<AddConnectionEntry
					key={module.baseInfo.name}
					module={module}
					addConnection={addConnection}
					showHelp={showHelp}
				/>
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

	return (
		<>
			<AddConnectionModal ref={addRef} doConfigureConnection={doConfigureConnection} showHelp={showHelp} />
			<div style={{ clear: 'both' }} className="row-heading">
				<h4>Add connection</h4>
				<p>
					Companion currently supports {modules.count} different things, and the list grows every day. If you can't find
					the device you're looking for, please{' '}
					<a target="_new" href="https://github.com/bitfocus/companion-module-requests">
						add a request
					</a>{' '}
					on GitHub
				</p>

				<SearchBox filter={filter} setFilter={setFilter} />
				<br />
			</div>
			<div id="connection_add_search_results">{candidates}</div>
		</>
	)
})

interface AddConnectionEntryProps {
	module: ModuleProductInfo
	addConnection(module: ModuleProductInfo): void
	showHelp(moduleId: string, moduleVersion: NewClientModuleVersionInfo2): void
}

function AddConnectionEntry({ module, addConnection, showHelp }: AddConnectionEntryProps) {
	const addConnectionClick = useCallback(() => addConnection(module), [addConnection, module])
	const showVersion: NewClientModuleVersionInfo2 | undefined =
		module.stableVersion ?? module.prereleaseVersion ?? module.releaseVersions[0]
	const showHelpClick = useCallback(
		() => showVersion && showHelp(module.baseInfo.id, showVersion),
		[showHelp, module.baseInfo.id, showVersion]
	)

	return (
		<div key={module.baseInfo.name + module.baseInfo.id}>
			<CButton color="primary" onClick={addConnectionClick}>
				Add
			</CButton>
			&nbsp;
			{module.stableVersion?.isLegacy && (
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
			{module.baseInfo.name}
			{showVersion?.hasHelp && (
				<div className="float_right" onClick={showHelpClick}>
					<FontAwesomeIcon icon={faQuestionCircle} />
				</div>
			)}
		</div>
	)
}

interface AddConnectionModalRef {
	show(info: ModuleProductInfo): void
}

interface AddConnectionModalProps {
	doConfigureConnection: (connectionId: string) => void
	showHelp: (moduleId: string, moduleVersion: NewClientModuleVersionInfo2) => void
}

const AddConnectionModal = observer(
	forwardRef<AddConnectionModalRef, AddConnectionModalProps>(function AddActionsModal(
		{ doConfigureConnection, showHelp },
		ref
	) {
		const { socket, notifier } = useContext(RootAppStoreContext)
		const connections = useContext(ConnectionsContext)

		const [show, setShow] = useState(false)
		const [moduleInfo, setModuleInfo] = useState<ModuleProductInfo | null>(null)
		const [selectedVersion, setSelectedVersion] = useState<ModuleVersionInfo>({
			mode: 'stable',
			id: null,
		})
		const [connectionLabel, setConnectionLabel] = useState<string>('')

		const doClose = useCallback(() => setShow(false), [])
		const onClosed = useCallback(() => {
			setModuleInfo(null)
			setSelectedVersion({
				mode: 'stable',
				id: null,
			})
			setConnectionLabel('')
		}, [])

		const doAction = () => {
			if (!moduleInfo || !connectionLabel || !selectedVersion) return

			socketEmitPromise(socket, 'connections:add', [
				{
					type: moduleInfo.baseInfo.id,
					product: moduleInfo.product,
				},
				connectionLabel,
				selectedVersion,
			])
				.then((id) => {
					console.log('NEW CONNECTION', id)
					setShow(false)
					setTimeout(() => {
						// Wait a bit to let the server catch up
						doConfigureConnection(id)
					}, 1000)
				})
				.catch((e) => {
					notifier.current?.show(`Failed to create connection`, `Failed: ${e}`)
					console.error('Failed to create connection:', e)
				})
		}

		useImperativeHandle(
			ref,
			() => ({
				show(info) {
					setShow(true)
					setModuleInfo(info)

					// TODO - make sure this is a valid selection
					setSelectedVersion({
						mode: 'stable',
						id: null,
					})
					setConnectionLabel(findNextConnectionLabel(connections, info))
				},
			}),
			[connections]
		)

		let selectedVersionIsLegacy = false
		switch (selectedVersion.mode) {
			case 'stable':
				selectedVersionIsLegacy = moduleInfo?.stableVersion?.isLegacy ?? false
				break
			case 'specific-version':
				selectedVersionIsLegacy =
					moduleInfo?.releaseVersions.find((v) => v.version.id === selectedVersion.id)?.isLegacy ?? false
				break
		}

		const moduleVersion = getModuleVersionInfoForConnection(moduleInfo, {
			moduleVersionMode: selectedVersion.mode,
			moduleVersionId: selectedVersion.id,
		})

		return (
			<CModalExt visible={show} onClose={doClose} onClosed={onClosed} scrollable={true}>
				{moduleInfo && (
					<>
						<CModalHeader closeButton>
							<h5>
								Add {moduleInfo.baseInfo.manufacturer} {moduleInfo.product}
							</h5>
						</CModalHeader>
						<CModalBody>
							<p>
								It is now possible to load install different versions of modules without updating Companion. Once you
								have installed different versions of a module, you can choose which one to use for a new connection
								here.
							</p>
							<CForm className="row g-3" onSubmit={PreventDefaultHandler}>
								<CFormLabel htmlFor="colFormLabel" className="col-sm-4 col-form-label col-form-label-sm">
									Label&nbsp;
								</CFormLabel>
								<CCol sm={8}>
									<CFormInput
										name="colFormLabel"
										value={connectionLabel}
										onChange={(e) => setConnectionLabel(e.currentTarget.value)}
									/>
								</CCol>

								<CFormLabel htmlFor="colFormVersion" className="col-sm-4 col-form-label col-form-label-sm">
									Module Version&nbsp;
									{moduleVersion?.hasHelp && (
										<div className="float_right" onClick={() => showHelp(moduleInfo.baseInfo.id, moduleVersion)}>
											<FontAwesomeIcon icon={faQuestionCircle} />
										</div>
									)}
								</CFormLabel>
								<CCol sm={8}>
									<CFormSelect
										name="colFormVersion"
										value={JSON.stringify(selectedVersion)}
										onChange={(e) => setSelectedVersion(JSON.parse(e.currentTarget.value))}
									>
										<ConnectionVersionSelectOptions moduleInfo={moduleInfo} />
									</CFormSelect>
								</CCol>
							</CForm>

							{selectedVersionIsLegacy && (
								<>
									<hr />
									<CAlert color="warning">
										<p>
											This module has not been verified to be compatible with this version of companion. It may be buggy
											or broken.
										</p>
										<p>
											If this module is broken, please let the module author know on{' '}
											<a target="_blank" rel="noreferrer" href={moduleInfo.baseInfo.bugUrl}>
												Github
											</a>
										</p>
									</CAlert>
								</>
							)}
						</CModalBody>
						<CModalFooter>
							<CButton color="secondary" onClick={doClose}>
								Cancel
							</CButton>
							<CButton
								color="primary"
								onClick={doAction}
								disabled={!moduleInfo || !connectionLabel || !selectedVersion}
							>
								Save
							</CButton>
						</CModalFooter>
					</>
				)}
			</CModalExt>
		)
	})
)

// nocommit TODO: this is a copy of the function from companion/lib/Instance/ConnectionConfigStore.ts
function findNextConnectionLabel(
	connections: Record<string, ClientConnectionConfig>,
	info: ModuleProductInfo,
	ignoreId?: string
): string {
	let prefix = info.baseInfo.shortname

	const knownLabels = new Set()
	for (const [id, obj] of Object.entries(connections)) {
		if (id !== ignoreId && obj && obj.label) {
			knownLabels.add(obj.label)
		}
	}

	prefix = makeLabelSafe(prefix)

	let label = prefix
	let i = 1
	while (knownLabels.has(label)) {
		// Try the next
		label = `${prefix}_${++i}`
	}

	return label
}

interface ConnectionVersionSelectOptionsProps {
	moduleInfo: NewClientModuleInfo
}
export function ConnectionVersionSelectOptions({ moduleInfo }: ConnectionVersionSelectOptionsProps) {
	return (
		<>
			{moduleInfo.stableVersion && (
				<option value={JSON.stringify(moduleInfo.stableVersion.version)}>{moduleInfo.stableVersion.displayName}</option>
			)}
			{moduleInfo.prereleaseVersion && (
				<option value={JSON.stringify(moduleInfo.prereleaseVersion.version)}>
					{moduleInfo.prereleaseVersion.displayName}
				</option>
			)}

			{moduleInfo.releaseVersions.map((version) => {
				return (
					<option key={JSON.stringify(version.version)} value={JSON.stringify(version.version)}>
						{version.displayName}
					</option>
				)
			})}

			{moduleInfo.customVersions.map((version) => {
				return (
					<option key={JSON.stringify(version.version)} value={JSON.stringify(version.version)}>
						{version.displayName}
					</option>
				)
			})}
		</>
	)
}
