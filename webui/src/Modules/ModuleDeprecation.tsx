/* eslint-disable react-refresh/only-export-components -- the lookup hook belongs beside the two components that render its result */
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useContext } from 'react'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Badge } from '~/Components/Badge.js'
import { InlineHelpCustom } from '~/Components/InlineHelp.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useModuleStoreInfo } from './useModuleStoreInfo.js'

/**
 * Why a module, or the version of it in use, should no longer be used. A `null` field means that
 * level is not deprecated; an empty string means it is, but the store gave no reason.
 */
export interface ModuleDeprecationInfo {
	/** The module as a whole has been deprecated */
	module: string | null
	/** The specific version in use has been deprecated */
	version: string | null
}

/**
 * Collect any deprecation notices covering a module, and the version of it in use. Returns `null`
 * when nothing is deprecated, so a caller can skip its wrapper markup entirely.
 *
 * Must be called from an `observer` component - it reads the module stores.
 */
export function useModuleDeprecation(
	moduleType: ModuleInstanceType,
	moduleId: string,
	/** The version in use, or `null` when no particular version is in context */
	versionId: string | null
): ModuleDeprecationInfo | null {
	const { modules } = useContext(RootAppStoreContext)

	// The store only publishes the versions it serves, so it can never deprecate a dev or builtin one
	const storeVersionId = versionId === null || versionId === 'dev' || versionId === 'builtin' ? null : versionId

	// Only pay for the per-module subscription when there is a store version to look up
	const moduleStoreInfo = useModuleStoreInfo(moduleType, storeVersionId === null ? undefined : moduleId)

	const moduleReason = modules.getStoreInfo(moduleType, moduleId)?.deprecationReason ?? null
	const versionReason =
		(storeVersionId === null
			? null
			: moduleStoreInfo?.versions.find((version) => version.id === storeVersionId)?.deprecationReason) ?? null

	if (moduleReason === null && versionReason === null) return null

	return { module: moduleReason, version: versionReason }
}

/**
 * One sentence per deprecated level, quoting the store's reason where it gave one.
 */
export function describeModuleDeprecation(deprecation: ModuleDeprecationInfo): string[] {
	const lines: string[] = []

	if (deprecation.module !== null) {
		lines.push(
			deprecation.module.trim()
				? `This module is deprecated: ${deprecation.module}`
				: 'This module is deprecated, and will receive no further updates. You should look for an alternative.'
		)
	}

	if (deprecation.version !== null) {
		lines.push(
			deprecation.version.trim()
				? `The version in use is deprecated: ${deprecation.version}`
				: 'The version in use is deprecated, and should be changed to a supported one.'
		)
	}

	return lines
}

/** A module-level deprecation shadows the whole module; a version-level one only the version in use */
export function moduleDeprecationLabel(deprecation: ModuleDeprecationInfo): string {
	return deprecation.module !== null ? 'Deprecated' : 'Deprecated version'
}

/**
 * A compact pill for a deprecated module, with the reasons in a tooltip. For list rows and headings,
 * where there is no space to spell them out.
 */
export function ModuleDeprecationBadge({
	deprecation,
	className,
}: {
	deprecation: ModuleDeprecationInfo
	className?: string
}): React.JSX.Element {
	const label = moduleDeprecationLabel(deprecation)

	return (
		<InlineHelpCustom
			help={describeModuleDeprecation(deprecation).map((line) => (
				<p key={line} className="mb-0">
					{line}
				</p>
			))}
			className={className}
		>
			<Badge color="warning" aria-label={label}>
				{label}
			</Badge>
		</InlineHelpCustom>
	)
}

/**
 * A spelled-out explanation of why a module is deprecated. For panels and modals, where there is room
 * for the reasons rather than hiding them behind a tooltip.
 */
export function ModuleDeprecationAlert({
	deprecation,
	className,
}: {
	deprecation: ModuleDeprecationInfo
	className?: string
}): React.JSX.Element {
	return (
		<StaticAlert color="warning" className={className}>
			<div className="flex gap-2">
				<FontAwesomeIcon icon={faTriangleExclamation} className="mt-1" />
				<div className="min-w-0">
					<strong>{moduleDeprecationLabel(deprecation)}</strong>
					{describeModuleDeprecation(deprecation).map((line) => (
						<p key={line} className="mb-0">
							{line}
						</p>
					))}
				</div>
			</div>
		</StaticAlert>
	)
}
