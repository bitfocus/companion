// @ts-check

/** @type {import('lint-staged').Configuration} */
export default {
	'*.{ts,tsx,cts,mts,js,jsx}': 'eslint',
	'*.{json,css,scss,md,yaml,yml}': 'prettier --check',

	// A change to any TypeScript file requires a full project type-check.
	// tsc uses project references (`--build`) and checks across files, so it
	// must run once over the whole project rather than on the staged files.
	// Returning a function (with no filenames appended) achieves this.
	'*.{ts,tsx,cts,mts}': () => 'tsc --build',
}
