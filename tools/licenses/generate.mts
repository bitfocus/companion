import { access } from 'node:fs/promises'
import path from 'node:path'
import {
	collectInstalledPackages,
	collectPackagesFromInputPaths,
	createLegalInventory,
	enforceLicensePolicy,
	writeLegalArtifacts,
	type LegalInventory,
	type ProjectIdentity,
	type ShippedPackage,
} from '@companion-module/tools/license'
import { readRecordedBundleInputs } from './inputs.mts'
import { collectRuntimeDependencyClosure } from './installed-tree.mts'
import { COMPANION_LICENSE_OVERRIDES } from './overrides.mts'
import { COMPANION_LICENSE_POLICY } from './policy.mts'

const repoDir = path.resolve(import.meta.dirname, '../..')

/**
 * Every Companion workspace is first party code covered by the repository's own LICENSE.md, so the whole repository
 * is one project. Its license comes from the root package.json, which is also what dist/package.json ships as, and
 * it is named as the application rather than as the workspace holding it.
 */
const companionProject: ProjectIdentity = {
	projectRoots: [repoDir],
	packageRoot: repoDir,
	name: 'companion',
	distributionLicense: undefined,
}

/**
 * Electron is a devDependency of the launcher workspace rather than a dependency, because it is the runtime the
 * launcher is packaged into rather than something it imports, but it is very much shipped.
 */
const LAUNCHER_EXTRA_SHIPPED_PACKAGES = ['electron']

export interface CompanionLegalInventory {
	inventory: LegalInventory
	diagnostics: string[]
}

/**
 * Everything the packaged application ships, in the three ways it ships it:
 *  - the esbuild and Vite bundles, whose contributing files the build recorded as it produced them,
 *  - the native dependencies yarn installs into dist/node_modules for the bundles to load at runtime,
 *  - the launcher's runtime dependencies and Electron itself, which electron-builder packs as real files.
 */
export async function collectCompanionLegalInventory(distDir: string): Promise<CompanionLegalInventory> {
	const bundleInputs = await readRecordedBundleInputs()
	const bundled = await collectPackagesFromInputPaths(
		bundleInputs.inputs,
		companionProject,
		COMPANION_LICENSE_OVERRIDES
	)

	// An empty result would otherwise be indistinguishable from the native dependencies not having been installed,
	// and would silently drop them and everything they depend on from the licenses shipped with the application
	const nativeExternalsDir = path.join(distDir, 'node_modules')
	await access(nativeExternalsDir).catch(() => {
		throw new Error(`${nativeExternalsDir} does not exist. The native dependencies must be installed first.`)
	})
	const nativeExternals = await collectInstalledPackages(nativeExternalsDir, COMPANION_LICENSE_OVERRIDES)
	const launcher = await collectRuntimeDependencyClosure(
		path.join(repoDir, 'launcher'),
		LAUNCHER_EXTRA_SHIPPED_PACKAGES
	)

	const packages: ShippedPackage[] = [...bundled.packages, ...nativeExternals, ...launcher.packages]
	const inventory = await createLegalInventory(packages)
	return {
		inventory,
		diagnostics: [
			...bundleInputs.diagnostics,
			...bundled.diagnostics,
			...launcher.diagnostics,
			...inventory.diagnostics,
		],
	}
}

/**
 * Writes dist/LICENSE and dist/NOTICE for what this build shipped, then fails the build if any of it is licensed in
 * a way Companion cannot distribute. Both need to happen before electron-builder copies dist into the application.
 */
export async function generateLegalArtifacts(distDir: string): Promise<void> {
	const { inventory, diagnostics } = await collectCompanionLegalInventory(distDir)
	for (const diagnostic of diagnostics) console.warn(`License inventory: ${diagnostic}`)

	await writeLegalArtifacts(distDir, inventory)
	console.log(`Wrote licenses for ${inventory.packages.length} shipped packages to ${path.join(distDir, 'LICENSE')}`)

	enforceLicensePolicy(inventory, COMPANION_LICENSE_POLICY, COMPANION_LICENSE_OVERRIDES)
}
