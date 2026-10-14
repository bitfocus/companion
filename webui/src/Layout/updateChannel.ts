export type UpdateChannel = 'stable' | 'beta' | 'experimental'

export const CHANNEL_BADGE: Record<UpdateChannel, { label: string; className: string }> = {
	stable: { label: 'stable', className: 'bg-tone-neutral-fill/15 text-tone-neutral-text' },
	beta: { label: 'beta', className: 'bg-tone-warning-fill/15 text-tone-warning-text' },
	experimental: { label: 'experimental', className: 'bg-tone-error-fill/15 text-tone-error-text' },
}

// The build string is `<version>+<commits>-<gitRef>-<hash>`, and useCompanionVersion strips the
// version prefix off into versionBuild. Tagged releases have no build suffix, a `beta` ref is a
// beta build, and anything else (main, a feature branch, ...) is experimental.
export function channelFromVersionBuild(versionBuild: string): UpdateChannel {
	if (versionBuild === '') return 'stable'
	if (versionBuild.toLowerCase().includes('beta')) return 'beta'
	return 'experimental'
}
