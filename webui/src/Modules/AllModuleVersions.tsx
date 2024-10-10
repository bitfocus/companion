import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileImport, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { HelpModal, HelpModalRef } from '../Connections/HelpModal.js'
import { NewClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { socketEmitPromise, useComputed } from '../util.js'
import { CAlert, CButton, CButtonGroup } from '@coreui/react'
import { NonIdealState } from '../Components/NonIdealState.js'

export const AllModuleVersions = observer(function AllModuleVersions() {
	const { socket, modules } = useContext(RootAppStoreContext)

	const helpModalRef = useRef<HelpModalRef>(null)
	// const showHelpClick = useCallback((e: React.MouseEvent) => {
	// 	const moduleId = e.currentTarget.getAttribute('data-module-id')
	// 	if (!moduleId) return

	// 	const versionId = e.currentTarget.getAttribute('data-version-id')
	// 	helpModalRef.current?.show(moduleId, versionId) // TODO - this needs to pass in more data too
	// }, [])

	const allSortedModules = useComputed(
		() => Array.from(modules.modules.values()).sort((a, b) => a.baseInfo.name.localeCompare(b.baseInfo.name)),
		[modules]
	)

	const [loadError, setLoadError] = useState<string | null>(null)

	const loadModuleFile = useCallback(
		(e: React.FormEvent<HTMLInputElement>) => {
			const newFile = e.currentTarget.files?.[0]
			e.currentTarget.value = null as any

			if (newFile === undefined || newFile.type === undefined) {
				setLoadError('Unable to read config file')
				return
			}

			var fr = new FileReader()
			fr.onload = () => {
				if (!fr.result) {
					setLoadError('Failed to load file contents')
					return
				}

				if (typeof fr.result === 'string') {
					setLoadError('Failed to load file contents in correct format')
					return
				}

				setLoadError(null)
				socketEmitPromise(socket, 'modules:install-custom-module', [new Uint8Array(fr.result)], 20000)
					.then((err) => {
						console.log('aaa', err)

						if (err) {
							setLoadError(err || 'Failed to prepare')
						} else {
							setLoadError(null)
							// const mode = config.type === 'page' ? 'import_page' : 'import_full'
							// modalRef.current.show(mode, config, initialRemap)
							// setImportInfo([config, initialRemap])
						}
					})
					.catch((e) => {
						setLoadError('Failed to load config to import')
						console.error('Failed to load config to import:', e)
					})
			}
			fr.readAsArrayBuffer(newFile)
		},
		[socket]
	)

	const [visibleModules, setVisibleConnections] = useState<VisibleAllModulesState>(() => loadVisibility())
	// Save the config when it changes
	useEffect(() => {
		window.localStorage.setItem('modules_manage_visible', JSON.stringify(visibleModules))
	}, [visibleModules])

	const doToggleVisibility = useCallback((key: keyof VisibleAllModulesState) => {
		setVisibleConnections((oldConfig) => ({
			...oldConfig,
			[key]: !oldConfig[key],
		}))
	}, [])

	const doToggleDev = useCallback(() => doToggleVisibility('dev'), [doToggleVisibility])
	const doToggleBuiltin = useCallback(() => doToggleVisibility('builtin'), [doToggleVisibility])
	const doToggleRelease = useCallback(() => doToggleVisibility('release'), [doToggleVisibility])
	const doToggleCustom = useCallback(() => doToggleVisibility('custom'), [doToggleVisibility])

	return (
		<>
			<HelpModal ref={helpModalRef} />

			<p>Use the button below to import a custom build of a module.</p>

			<div>
				{loadError ? <CAlert color="warning">{loadError}</CAlert> : ''}

				<label className="btn btn-warning btn-file">
					<FontAwesomeIcon icon={faFileImport} style={{ marginRight: 8, marginLeft: -3 }} />
					Import module
					<input type="file" onChange={loadModuleFile} style={{ display: 'none' }} accept=".tgz" />
				</label>
			</div>

			<div className="module-manager-list2">
				<table className="table table-responsive-sm width-100">
					<thead>
						<tr>
							<th>Name</th>
							<th className="fit">
								<CButtonGroup style={{ float: 'right', margin: 0 }}>
									<CButton
										size="sm"
										color="secondary"
										style={{
											backgroundColor: 'white',
											opacity: visibleModules.dev ? 1 : 0.4,
											padding: '1px 5px',
											color: 'black',
										}}
										onClick={doToggleDev}
									>
										Dev
									</CButton>
									<CButton
										size="sm"
										color="success"
										style={{ opacity: visibleModules.builtin ? 1 : 0.4, padding: '1px 5px' }}
										onClick={doToggleBuiltin}
									>
										Builtin
									</CButton>
									<CButton
										color="warning"
										size="sm"
										style={{ opacity: visibleModules.release ? 1 : 0.4, padding: '1px 5px' }}
										onClick={doToggleRelease}
									>
										Release
									</CButton>
									<CButton
										color="danger"
										size="sm"
										style={{ opacity: visibleModules.custom ? 1 : 0.4, padding: '1px 5px' }}
										onClick={doToggleCustom}
									>
										Custom
									</CButton>
								</CButtonGroup>
							</th>
						</tr>
					</thead>
					<tbody>
						{!visibleModules.dev && !visibleModules.builtin && !visibleModules.release && !visibleModules.custom && (
							<tr>
								<td colSpan={3}>
									<NonIdealState icon={faQuestionCircle}>
										You have hidden all types of modules. <br />
										Unhide some with the filters in the top right.
									</NonIdealState>
								</td>
							</tr>
						)}
						{allSortedModules.map((moduleInfo) => (
							<ModuleEntry key={moduleInfo.baseInfo.id} visibleModules={visibleModules} moduleInfo={moduleInfo} />
						))}
					</tbody>
				</table>
			</div>
		</>
	)
})

interface ModuleEntryProps {
	visibleModules: VisibleAllModulesState
	moduleInfo: NewClientModuleInfo
}

const ModuleEntry = observer(function ModuleEntry({ visibleModules, moduleInfo }: ModuleEntryProps) {
	const { socket } = useContext(RootAppStoreContext)

	return (
		<>
			{visibleModules.dev && moduleInfo.hasDevVersion && (
				<tr>
					<td>{moduleInfo.baseInfo.id} - DEV</td>
					<td>&nbsp;</td>
				</tr>
			)}

			{moduleInfo.releaseVersions.map((v) => {
				if (!visibleModules.release && !v.isBuiltin) return null
				if (!visibleModules.builtin && v.isBuiltin) return null

				return (
					<tr>
						<td>
							{moduleInfo.baseInfo.id} - {v.isBuiltin ? 'builtin' : 'from store'} {v.version.id}
						</td>
						<td>&nbsp;</td>
					</tr>
				)
			})}

			{visibleModules.custom &&
				moduleInfo.customVersions.map((v) => (
					<tr>
						<td>
							{moduleInfo.baseInfo.id} - custom {v.version.id}
						</td>
						<td>
							<CButton
								color="danger"
								size="sm"
								onClick={() => {
									// TODO
									console.log('aaa')
									if (v.version.id) {
										socketEmitPromise(
											socket,
											'modules:uninstall-custom-module',
											[moduleInfo.baseInfo.id, v.version.id],
											20000
										).catch((e) => {
											console.error('Failed to uninstall module:', e)
										})
									}
								}}
							>
								Remove
							</CButton>
						</td>
					</tr>
				))}
		</>
	)
})

interface VisibleAllModulesState {
	dev: boolean
	builtin: boolean
	release: boolean
	custom: boolean
}

function loadVisibility(): VisibleAllModulesState {
	try {
		const rawConfig = window.localStorage.getItem('modules_manage_visible')
		if (rawConfig !== null) {
			return JSON.parse(rawConfig) ?? {}
		}
	} catch (e) {}

	// setup defaults
	const config: VisibleAllModulesState = {
		dev: true,
		builtin: true,
		release: true,
		custom: true,
	}

	window.localStorage.setItem('modules_manage_visible', JSON.stringify(config))

	return config
}
