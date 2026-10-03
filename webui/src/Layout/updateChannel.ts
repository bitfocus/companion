export type UpdateChannel = 'stable' | 'beta' | 'experimental'

export const CHANNEL_BADGE: Record<UpdateChannel, { label: string; className: string }> = {
	stable: { label: 'stable', className: 'bg-zinc-500/15 text-zinc-400' },
	beta: { label: 'beta', className: 'bg-amber-500/15 text-amber-500' },
	experimental: { label: 'experimental', className: 'bg-red-500/15 text-red-500' },
}

// The build string is `<version>+<commits>-<gitRef>-<hash>`, and useCompanionVersion strips the
// version prefix off into versionBuild. Tagged releases have no build suffix, a `beta` ref is a
// beta build, and anything else (main, a feature branch, ...) is experimental.
export function channelFromVersionBuild(versionBuild: string): UpdateChannel {
	if (versionBuild === '') return 'stable'
	if (versionBuild.toLowerCase().includes('beta')) return 'beta'
	return 'experimental'
}
