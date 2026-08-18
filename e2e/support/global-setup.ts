import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * The backend serves the webui from webui/build, so a build must exist. It is expensive
 * (a minute or more), so reuse an existing build unless explicitly asked not to.
 */
export default function globalSetup(): void {
	const repoRoot = path.join(import.meta.dirname, '../..')
	const indexHtml = path.join(repoRoot, 'webui/build/index.html')

	if (fs.existsSync(indexHtml) && !process.env.E2E_FORCE_WEBUI_BUILD) return

	console.log('Building webui (this takes a few minutes)...')
	execSync('yarn workspace @companion-app/webui build', { cwd: repoRoot, stdio: 'inherit' })
}
