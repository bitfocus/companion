import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
	faExclamationTriangle,
	faFileImport,
	faQuestionCircle,
	faRectangleList,
} from '@fortawesome/free-solid-svg-icons'
import { HelpModal, HelpModalRef } from '../Connections/HelpModal.js'
import {
	ModuleVersionInfo,
	NewClientModuleInfo,
	NewClientModuleVersionInfo2,
} from '@companion-app/shared/Model/ModuleInfo.js'
import { socketEmitPromise, useComputed } from '../util.js'
import { getModuleVersionInfoForConnection } from '../Connections/Util.js'
import { CAlert } from '@coreui/react'

export const AllModuleVersions = observer(function InstalledModules() {
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
		(e: FormEvent<HTMLInputElement>) => {
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
				{allSortedModules.map((m) => (
					<ModuleEntry key={m.baseInfo.id} moduleInfo={m} />
				))}
			</div>
		</>
	)
})

interface ModuleEntryProps {
	moduleInfo: NewClientModuleInfo
}

const ModuleEntry = observer(function ModuleEntry({ moduleInfo }: ModuleEntryProps) {
	return (
		<>
			{moduleInfo.hasDevVersion && <p>{moduleInfo.baseInfo.id} - DEV</p>}

			{moduleInfo.releaseVersions.map((v) => (
				<p>
					{moduleInfo.baseInfo.id} - {v.isBuiltin ? 'builtin' : 'from store'} {v.version.id}
				</p>
			))}

			{moduleInfo.customVersions.map((v) => (
				<p>
					{moduleInfo.baseInfo.id} - custom {v.version.id}
				</p>
			))}
		</>
	)
})
