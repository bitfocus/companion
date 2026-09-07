import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { packageFromJson, type ShippedPackage } from '@companion-module/tools/license'
import { COMPANION_LICENSE_OVERRIDES } from './overrides.mts'

interface DependencyPackageJson {
	name?: string
	version?: string
	dependencies?: Record<string, string>
	optionalDependencies?: Record<string, string>
}

async function readPackageJson(packageRoot: string): Promise<DependencyPackageJson> {
	return JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'))
}

/**
 * Node's own resolution, restricted to package roots: walk up from `fromDir` looking for the package in each
 * node_modules on the way. This finds hoisted packages the same way the runtime does, and finds the nested copy
 * yarn installs for a version conflict, without needing the package to expose its package.json through its exports.
 */
async function resolvePackageRoot(fromDir: string, name: string): Promise<string | undefined> {
	let currentDir = fromDir
	while (true) {
		const candidate = path.join(currentDir, 'node_modules', name)
		try {
			await readPackageJson(candidate)
			return candidate
		} catch {
			const parentDir = path.dirname(currentDir)
			if (parentDir === currentDir) return undefined
			currentDir = parentDir
		}
	}
}

export interface InstalledClosure {
	packages: ShippedPackage[]
	diagnostics: string[]
}

/**
 * The packages a workspace ships as real files rather than bundling, which is what electron-builder packs alongside
 * the launcher: its runtime dependencies, transitively, plus any extra roots the build adds itself (electron).
 *
 * Workspace packages resolve to a symlink out of node_modules and back into the repository. Those are Companion's
 * own code, already attributed to the project by the bundle inventory, so they are followed but not listed again.
 */
export async function collectRuntimeDependencyClosure(
	workspaceDir: string,
	extraRootPackages: string[]
): Promise<InstalledClosure> {
	const packages: ShippedPackage[] = []
	const diagnostics: string[] = []
	const visited = new Set<string>()

	const rootPackageJson = await readPackageJson(workspaceDir)
	const queue: Array<{ name: string; fromDir: string }> = [
		...Object.keys(rootPackageJson.dependencies ?? {}),
		...Object.keys(rootPackageJson.optionalDependencies ?? {}),
		...extraRootPackages,
	].map((name) => ({ name, fromDir: workspaceDir }))

	while (queue.length) {
		const { name, fromDir } = queue.shift()!
		const packageRoot = await resolvePackageRoot(fromDir, name)
		if (!packageRoot) {
			// An optional dependency for another platform is the usual reason, and never ships in this build
			diagnostics.push(`Ignoring unresolvable runtime dependency of ${path.basename(workspaceDir)}: ${name}`)
			continue
		}
		if (visited.has(packageRoot)) continue
		visited.add(packageRoot)

		const packageJson = await readPackageJson(packageRoot)
		for (const dependencyName of [
			...Object.keys(packageJson.dependencies ?? {}),
			...Object.keys(packageJson.optionalDependencies ?? {}),
		]) {
			queue.push({ name: dependencyName, fromDir: packageRoot })
		}

		// A workspace resolves to a symlink pointing back into the repository, so its realpath escapes node_modules
		if (!(await realpath(packageRoot)).split(path.sep).includes('node_modules')) continue

		packages.push(packageFromJson('external', packageRoot, packageJson, COMPANION_LICENSE_OVERRIDES))
	}

	return { packages, diagnostics }
}
