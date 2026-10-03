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

/** What a notice is about. The heading already names it, so the reason itself need not repeat it. */
export type ModuleDeprecationSubject = 'module' | 'version'

export interface ModuleDeprecationNotice {
	subject: ModuleDeprecationSubject
	/** The store's reason, or advice to act on where the store gave nothing worth showing */
	text: string
}

/** Heading when a notice stands alone, and label when it shares the block with the other subject */
export const MODULE_DEPRECATION_TITLES: Record<ModuleDeprecationSubject, string> = {
	module: 'Deprecated module',
	version: 'Deprecated version',
}
export const MODULE_DEPRECATION_LABELS: Record<ModuleDeprecationSubject, string> = {
	module: 'This module',
	version: 'The version in use',
}

/** What the store sends when it has nothing to say beyond the fact of the deprecation */
const BOILERPLATE_REASON: Record<ModuleDeprecationSubject, RegExp> = {
	module: /^module is deprecated[.!]?$/i,
	version: /^version is deprecated[.!]?$/i,
}

const FALLBACK_ADVICE: Record<ModuleDeprecationSubject, string> = {
	module: 'It will receive no further updates. You should look for an alternative.',
	version: 'You should change to a version that is still supported.',
}

/**
 * The store's reason, less any leading line that only restates the deprecation - most entries open
 * with its boilerplate, which the heading already says. Falls back to advice when nothing is left.
 */
function reasonText(subject: ModuleDeprecationSubject, reason: string): string {
	const lines = reason.trim().split('\n')
	if (lines.length > 0 && BOILERPLATE_REASON[subject].test(lines[0].trim())) lines.shift()

	return lines.join('\n').trim() || FALLBACK_ADVICE[subject]
}

/**
 * One notice per deprecated level, in the order the user should read them.
 */
export function describeModuleDeprecation(deprecation: ModuleDeprecationInfo): ModuleDeprecationNotice[] {
	const notices: ModuleDeprecationNotice[] = []

	if (deprecation.module !== null) notices.push({ subject: 'module', text: reasonText('module', deprecation.module) })
	if (deprecation.version !== null)
		notices.push({ subject: 'version', text: reasonText('version', deprecation.version) })

	return notices
}

/** A module-level deprecation shadows the whole module; a version-level one only the version in use */
export function moduleDeprecationLabel(deprecation: ModuleDeprecationInfo): string {
	return deprecation.module !== null ? 'Deprecated' : 'Deprecated version'
}

/**
 * The notices as text. A lone notice needs no label - whatever heads the block already names its
 * subject - but two of them have to say which is which. Reasons keep their own line breaks.
 */
function ModuleDeprecationNotices({ notices }: { notices: ModuleDeprecationNotice[] }): React.JSX.Element {
	return (
		<>
			{notices.map((notice) => (
				<p key={notice.subject} className="mb-0 whitespace-pre-line">
					{notices.length > 1 && <strong>{MODULE_DEPRECATION_LABELS[notice.subject]}: </strong>}
					{notice.text}
				</p>
			))}
		</>
	)
}

/** Names the subject when there is only one, and stays generic when both are deprecated */
function noticesHeading(notices: ModuleDeprecationNotice[]): string {
	return notices.length === 1 ? MODULE_DEPRECATION_TITLES[notices[0].subject] : 'Deprecated'
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
	const notices = describeModuleDeprecation(deprecation)

	return (
		<InlineHelpCustom help={<ModuleDeprecationNotices notices={notices} />} className={className}>
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
	const notices = describeModuleDeprecation(deprecation)

	return (
		<StaticAlert color="warning" className={className}>
			<div className="flex gap-2">
				<FontAwesomeIcon icon={faTriangleExclamation} className="mt-1" />
				<div className="min-w-0">
					<strong>{noticesHeading(notices)}</strong>
					<ModuleDeprecationNotices notices={notices} />
				</div>
			</div>
		</StaticAlert>
	)
}
