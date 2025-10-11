import { CAlert, CButton } from '@coreui/react'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import React, { useCallback } from 'react'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useComputed } from '~/Resources/util.js'
import { ClientInstanceConfigBase } from '@companion-app/shared/Model/Instance.js'
import { ModuleInfoStore } from '~/Stores/ModuleInfoStore'

// eslint-disable-next-line react-refresh/only-export-components
export function useMissingVersionsCount(
	modules: ModuleInfoStore,
	instances: ReadonlyMap<string, ClientInstanceConfigBase>
): number {
	return useComputed(() => {
		let count = 0

		for (const instance of instances.values()) {
			if (instance.moduleVersionId === null) {
				count++
				continue
			}

			const module = modules.modules.get(instance.moduleId)
			if (!module) {
				count++
				continue
			}

			// check for version
			if (module.devVersion && instance.moduleVersionId === 'dev') continue
			if (module.installedVersions.find((v) => v.versionId === instance.moduleVersionId)) continue

			// Not found
			count++
		}

		return count
	}, [instances, modules])
}

export interface MissingVersionsWarningProps {
	modules: ModuleInfoStore
	instances: ReadonlyMap<string, ClientInstanceConfigBase>
}

export const MissingVersionsWarning = observer(function MissingVersionsWarning({
	modules,
	instances,
}: MissingVersionsWarningProps) {
	const missingCount = useMissingVersionsCount(modules, instances)

	const installMissingMutation = useMutationExt(trpc.instances.modulesManager.installAllMissing.mutationOptions())

	const moduleType = modules.moduleType
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
