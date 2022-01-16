/** @type {import('@jest/types').Config.InitialOptions} */
const config = {
	verbose: true,
	testPathIgnorePatterns: ['module-local-dev'],
	roots: ['test'],
}

module.exports = config
