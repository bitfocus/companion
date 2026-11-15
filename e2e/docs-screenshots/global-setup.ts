import { execSync } from 'node:child_process'
import path from 'node:path'

/**
 * Provision what the scenarios' apps need, before any of them starts: the node runtimes their connections run on, and
 * the pinned real modules. The apps would otherwise fetch them as they start, which a cold cache can make take longer
 * than an app is given to start
 */
export default function docsGlobalSetup(): void {
	const repoRoot = path.join(import.meta.dirname, '../..')

	execSync('yarn fetch-runtimes', { cwd: repoRoot, stdio: 'inherit' })
	execSync(
		'node --conditions=companion:source --import tsx companion/test/docs-scenarios/modules/cache-real-modules.mts',
		{ cwd: repoRoot, stdio: 'inherit' }
	)
}
