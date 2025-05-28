import { CAlert, CButton } from '@coreui/react'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useContext, useCallback } from 'react'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { useComputed } from '../../util.js'

export const MissingVersionsWarning = observer(function MissingVersionsWarning() {
	const { socket, connections, modules } = useContext(RootAppStoreContext)

	const missingCount = useComputed(() => {
		let count = 0

		for (const connection of connections.connections.values()) {
			if (connection.moduleVersionId === null) {
				count++
				continue
			}

			const module = modules.modules.get(connection.instance_type)
			if (!module) {
				count++
				continue
			}

			// check for version
			if (module.devVersion && connection.moduleVersionId === 'dev') continue
			if (module.installedVersions.find((v) => v.versionId === connection.moduleVersionId)) continue

			// Not found
			count++
		}

		return count
	}, [connections, modules])

	const doInstallAllMissing = useCallback(() => {
		socket.emitPromise('modules:install-all-missing', []).catch((e) => {
			console.error('Install all missing failed', e)
		})
	}, [socket])

	if (missingCount === 0) return null

	return (
		<CAlert color="info">
			Some modules do not have versions specified, or are not installed.
			<br />
			<CButton color="info" className="mt-2" onClick={doInstallAllMissing}>
				<FontAwesomeIcon icon={faDownload} />
				&nbsp;Download &amp; Install missing versions
			</CButton>
		</CAlert>
	)
})
