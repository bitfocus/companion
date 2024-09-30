import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faExclamationTriangle, faQuestionCircle, faRectangleList } from '@fortawesome/free-solid-svg-icons'
import { HelpModal, HelpModalRef } from '../Connections/HelpModal.js'
import {
	ModuleVersionInfo,
	NewClientModuleInfo,
	NewClientModuleVersionInfo2,
} from '@companion-app/shared/Model/ModuleInfo.js'
import { socketEmitPromise, useComputed } from '../util.js'
import { getModuleVersionInfoForConnection } from '../Connections/Util.js'

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

	return (
		<>
			<HelpModal ref={helpModalRef} />

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
