import { faDownload, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useState } from 'react'
import { ModuleInstanceType, type ClientInstanceConfigBase } from '@companion-app/shared/Model/Instance.js'
import type { ClientModuleInfo } from '@companion-app/shared/Model/ModuleInfo.js'
import { Button } from '~/Components/Button'
import { Note } from '~/Components/Note.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useComputed } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore'

export interface MissingModuleVersions {
	/** Instances whose module version isn't installed but can be fetched from the store */
	installable: number
	/** Modules whose dev or builtin version isn't loaded. The store never has these, so they can't be installed */
	notLoaded: { moduleId: string; versionId: 'dev' | 'builtin' }[]
}

/** Sorts the instances whose module version isn't available by whether installing from the store can fix them */
// eslint-disable-next-line react-refresh/only-export-components
export function findMissingModuleVersions(
	instances: Iterable<ClientInstanceConfigBase>,
	getModuleInfo: (moduleId: string) => ClientModuleInfo | undefined
): MissingModuleVersions {
	let installable = 0
	const notLoaded = new Map<string, MissingModuleVersions['notLoaded'][number]>()

	for (const instance of instances) {
		const versionId = instance.moduleVersionId
		if (versionId === null) {
			installable++
			continue
		}

		const moduleInfo = getModuleInfo(instance.moduleId)

		if (versionId === 'dev' || versionId === 'builtin') {
			const loaded = versionId === 'dev' ? moduleInfo?.devVersion : moduleInfo?.builtinVersion
			if (!loaded) notLoaded.set(`${versionId}:${instance.moduleId}`, { moduleId: instance.moduleId, versionId })
			continue
		}

		if (!moduleInfo?.installedVersions.some((v) => v.versionId === versionId)) installable++
	}

	return { installable, notLoaded: [...notLoaded.values()] }
}

// eslint-disable-next-line react-refresh/only-export-components
export function useMissingModuleVersions(
	moduleType: ModuleInstanceType,
	instances: ReadonlyMap<string, ClientInstanceConfigBase>
): MissingModuleVersions {
	const { modules } = useContext(RootAppStoreContext)

	return useComputed(
		() => findMissingModuleVersions(instances.values(), (moduleId) => modules.getModuleInfo(moduleType, moduleId)),
		[instances, modules, moduleType]
	)
}

export interface MissingVersionsWarningProps {
	moduleType: ModuleInstanceType
	instances: ReadonlyMap<string, ClientInstanceConfigBase>
}

export const MissingVersionsWarning = observer(function MissingVersionsWarning({
	moduleType,
	instances,
}: MissingVersionsWarningProps) {
	const { installable, notLoaded } = useMissingModuleVersions(moduleType, instances)

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

	if (installable === 0 && notLoaded.length === 0) return null

	const noun = moduleType === ModuleInstanceType.Connection ? 'connection' : 'surface integration'
	const devModules = notLoaded.filter((m) => m.versionId === 'dev').map((m) => m.moduleId)
	const builtinModules = notLoaded.filter((m) => m.versionId === 'builtin').map((m) => m.moduleId)

	return (
		<div className="flex flex-col gap-2">
			{installable > 0 && (
				<Note
					tone="warning"
					icon={faTriangleExclamation}
					actions={
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
					}
				>
					{installable === 1 ? `1 ${noun} has` : `${installable} ${noun}s have`} no installed module version
				</Note>
			)}
			{devModules.length > 0 && (
				<Note tone="warning" icon={faTriangleExclamation} actions={null}>
					{devModules.length === 1
						? `Unable to load development version of module ${quoteList(devModules)}. Check that it exists in your developer modules folder.`
						: `Unable to load development versions of modules ${quoteList(devModules)}. Check that they exist in your developer modules folder.`}
				</Note>
			)}
			{builtinModules.length > 0 && (
				<Note tone="warning" icon={faTriangleExclamation} actions={null}>
					{builtinModules.length === 1
						? `Unable to load built-in version of module ${quoteList(builtinModules)}. Your Companion installation may be incomplete.`
						: `Unable to load built-in versions of modules ${quoteList(builtinModules)}. Your Companion installation may be incomplete.`}
				</Note>
			)}
		</div>
	)
})

function quoteList(moduleIds: string[]): string {
	return moduleIds.map((id) => `"${id}"`).join(', ')
}
