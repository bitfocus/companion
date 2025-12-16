import { CAlert, CButton } from '@coreui/react'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext } from 'react'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useComputed } from '~/Resources/util.js'
import type { ClientInstanceConfigBase, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore'

// eslint-disable-next-line react-refresh/only-export-components
export function useMissingVersionsCount(
	moduleType: ModuleInstanceType,
	instances: ReadonlyMap<string, ClientInstanceConfigBase>
): number {
	const { modules } = useContext(RootAppStoreContext)

	return useComputed(() => {
		let count = 0

		for (const instance of instances.values()) {
			if (instance.moduleVersionId === null) {
				count++
				continue
			}

			const moduleInfo = modules.getModuleInfo(moduleType, instance.moduleId)
			if (!moduleInfo) {
				count++
				continue
			}

			// check for version
			if (moduleInfo.devVersion && instance.moduleVersionId === 'dev') continue
			if (moduleInfo.builtinVersion && instance.moduleVersionId === 'builtin') continue
			if (moduleInfo.installedVersions.find((v) => v.versionId === instance.moduleVersionId)) continue

			// Not found
			count++
		}

		return count
	}, [instances, modules, moduleType])
}

export interface MissingVersionsWarningProps {
	moduleType: ModuleInstanceType
	instances: ReadonlyMap<string, ClientInstanceConfigBase>
}

export const MissingVersionsWarning = observer(function MissingVersionsWarning({
	moduleType,
	instances,
}: MissingVersionsWarningProps) {
	const missingCount = useMissingVersionsCount(moduleType, instances)

	const installMissingMutation = useMutationExt(trpc.instances.modulesManager.installAllMissing.mutationOptions())

	const doInstallAllMissing = useCallback(() => {
		installMissingMutation.mutateAsync({ moduleType }).catch((e) => {
			console.error('Install all missing failed', e)
		})
	}, [installMissingMutation, moduleType])

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
