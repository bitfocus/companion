/**
 * Boot a real Companion application for e2e tests, reusing the integration-test fixture.
 *
 * Run via `node --conditions=companion:source --import tsx e2e/support/launch-app.mts` (see
 * companion.ts) so the workspace packages resolve to their TS sources, the same way `yarn dev`
 * runs the app.
 *
 * Prints a COMPANION_READY marker line with the bound port once the app is listening, and shuts
 * down gracefully on SIGTERM/SIGINT.
 */

// The fixture lives in the companion package and is fully type-checked there. Import it via a
// non-literal specifier so this standalone tsconfig doesn't re-check the whole backend source
// tree with mismatched compiler settings
interface TestAppSlice {
	httpPort: number
	configDir: string
	close(): Promise<void>
}
const testAppModulePath = '../../companion/test/integration/TestApp.js'
const { createTestApp } = (await import(testAppModulePath)) as {
	createTestApp: (options: { configDir: string | null }) => Promise<TestAppSlice>
}

const app = await createTestApp({ configDir: null, extraModulePath: null })

process.stdout.write(`COMPANION_READY ${JSON.stringify({ port: app.httpPort, configDir: app.configDir })}\n`)

let shuttingDown = false
function shutdown(): void {
	if (shuttingDown) return
	shuttingDown = true
	app.close().then(
		() => process.exit(0),
		() => process.exit(1)
	)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
