/*
 * Downloads the prebuilt connection modules the integration tests spawn as real child processes,
 * into the repo's `.cache`. Run before the tests (like `yarn fetch-runtimes`):
 *
 *   yarn fetch-test-modules
 *
 * The tests also trigger this on demand when a module is missing, so a manual run is only needed to
 * pre-warm the cache. Versions are pinned and checksum-verified in fetch-portal-module.mts.
 */
// The helper lives in the companion test tree, which this tools project does not compile, so import
// it via a non-literal specifier (opaquely) rather than type-checking across the project boundary -
// the same trick TestApp.ts / launch-app.mts use for cross-tree imports
const helperPath = '../companion/test/integration/modules/fetch-portal-module.mjs'
const { ALL_PORTAL_MODULE_PINS, ensurePortalModule } = (await import(helperPath)) as {
	ALL_PORTAL_MODULE_PINS: { id: string; version: string }[]
	ensurePortalModule: (pin: { id: string; version: string }) => Promise<string>
}

for (const pin of ALL_PORTAL_MODULE_PINS) {
	console.log(`Fetching ${pin.id} (${pin.version})`)
	await ensurePortalModule(pin)
}
console.log('Done')
