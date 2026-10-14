import { faDownload, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useState } from 'react'
import { ModuleInstanceType, type ClientInstanceConfigBase } from '@companion-app/shared/Model/Instance.js'
import { Button } from '~/Components/Button'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useComputed } from '~/Resources/util.js'
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

	const [installing, setInstalling] = useState(false)
	const doInstallAllMissing = useCallback(() => {
		setInstalling(true)
		installMissingMutation
			.mutateAsync({ moduleType })
			.catch((e) => {
				console.error('Install all missing failed', e)
			})
			.finally(() => setInstalling(false))
	}, [installMissingMutation, moduleType])

	if (missingCount === 0) return null

	const noun = moduleType === ModuleInstanceType.Connection ? 'connection' : 'surface integration'

	return (
		<div className="edit-note edit-note-warning flex-wrap" role="status">
			<FontAwesomeIcon icon={faTriangleExclamation} className="edit-note-icon" aria-hidden="true" />
			<span className="grow">
				{missingCount === 1 ? `1 ${noun} has` : `${missingCount} ${noun}s have`} no installed module version
			</span>
			<Button
				variant="outline"
				size="sm"
				className="inline-flex items-center gap-1.5"
				onClick={doInstallAllMissing}
				disabled={installing}
				aria-busy={installing}
			>
				<FontAwesomeIcon icon={faDownload} aria-hidden="true" />
				Install missing
			</Button>
		</div>
	)
})
