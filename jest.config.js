/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	verbose: true,
	testPathIgnorePatterns: ['module-local-dev'],
	roots: ['companion/test', 'shared-lib/test'],
}
export default config
