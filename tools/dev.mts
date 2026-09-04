#!/usr/bin/env node
import { ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import semver from 'semver'
import { $, argv, usePowerShell } from 'zx'
import { devThreadOutDir, startDevThreadBuild } from './build_dev_threads.mts'
import { determinePlatformInfo } from './build/util.mts'
import { ensureBuiltinSurfaceModulesDirExists, fetchBuiltinSurfaceModules } from './fetch_builtin_modules.mts'
import { fetchNodejs } from './fetch_nodejs.mts'

if (process.platform === 'win32') {
	usePowerShell() // to enable powershell
}

await $`tsx ../tools/build_writefile.mts`

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const nodeJsValidRange = new semver.Range(packageJson.engines.node)
if (!semver.satisfies(process.versions.node, nodeJsValidRange)) {
	console.error(
		`This project requires Node.js version ${nodeJsValidRange} but you are using version ${process.versions.node}.`
	)
	console.error('Please update your Node.js installation.')
	process.exit(1)
}

const repoRoot = path.join(import.meta.dirname, '..')

let node: ChildProcess | null = null
const nodeArgs: string[] = []

const rawDevModulesPath = process.env.COMPANION_DEV_MODULES || argv['extra-module-path'] || './module-local-dev'
const devModulesPath = rawDevModulesPath ? path.resolve(repoRoot, rawDevModulesPath) : undefined

if (devModulesPath) {
	const argvIndex = process.argv.indexOf('--extra-module-path')
	if (argvIndex === -1) {
		process.argv.push('--extra-module-path', devModulesPath)
	} else {
		process.argv[argvIndex + 1] = devModulesPath
	}
}

// Set the ui port from env if not already set in argv
const rawAdminPort = process.env.COMPANION_APP_PORT
if (rawAdminPort && !argv['admin-port']) {
	process.argv.push('--admin-port', String(rawAdminPort))
}

// Populate a default for this env var
if (process.env.COMPANION_ENABLE_SHELL_COMMAND_SUPPORT === undefined) {
	process.env.COMPANION_ENABLE_SHELL_COMMAND_SUPPORT = '1'
}
if (process.env.COMPANION_TRUSTED_PROXIES === undefined) {
	// Allow vite as a proxy
	process.env.COMPANION_TRUSTED_PROXIES = 'loopback'
}

// Allow overriding the config base dir, resolved relative to the repo root
if (process.env.COMPANION_CONFIG_BASEDIR) {
	const configBaseDir = path.resolve(repoRoot, process.env.COMPANION_CONFIG_BASEDIR)
	process.argv.push(`--config-dir=${configBaseDir}`)
}

const inspectIndex = process.argv.findIndex((arg) => arg.startsWith('--inspect'))
if (inspectIndex !== -1) {
	const inspectArg = process.argv[inspectIndex]
	process.argv.splice(inspectIndex, 1)
	nodeArgs.push(inspectArg)
}

console.log('Ensuring nodejs binaries are available')

const platformInfo = determinePlatformInfo(undefined)
await fetchNodejs(platformInfo)

console.log('Ensuring builtin modules are installed')

if (process.env.COMPANION_SKIP_BUILTIN_SURFACE_MODULES) {
	console.log('Skipping builtin surface modules (COMPANION_SKIP_BUILTIN_SURFACE_MODULES is set)')
	await ensureBuiltinSurfaceModulesDirExists()
} else {
	console.log('Ensuring builtin modules are installed')
	await fetchBuiltinSurfaceModules()
}

console.log('Ensuring bundled modules are synced')

await $`git submodule init`
await $`git submodule sync`
await $`git submodule update`

// The backend and shared-lib run directly from their TypeScript sources via tsx (below), so there
// is no `tsc` emit to perform first. Only the webui needs a build up-front, since the backend
// serves `webui/build`.
if (!fs.existsSync('../webui/build')) {
	await $`yarn workspace @companion-app/webui build`.catch((e) => {
		console.error(e)
	})
} else {
	console.warn('Skipping webui build, you may need to run `yarn dist:webui` if changes have been made recently')
}

// Bundle the worker-thread / module-subprocess entrypoints with esbuild (watched). These cannot run
// from raw source under tsx: the module subprocesses run in Node's --permission sandbox with a
// stripped env, so no tsx loader reaches them. Everything else runs from source. Wait for the first
// build so the backend never spawns a thread before its bundle exists.
console.log('Building worker-thread entrypoints (esbuild, watched)')
await startDevThreadBuild()

function start() {
	// Run the backend directly from TypeScript source, watched+restarted by `tsx watch`. tsx is
	// launched through zx's shell (like the tsx call above) so the binary resolves cross-platform.
	// The companion:source condition (via NODE_OPTIONS, so it also reaches child node processes)
	// redirects @companion-app/shared imports to its `.ts` sources. COMPANION_DEV_THREAD_DIR tells
	// the backend where to find the esbuild-bundled thread entrypoints; COMPANION_DEV_MODULES_PATH
	// tells main-dev.ts which local-dev module directory to watch for hot-reload. Any --inspect flag
	// is placed after `watch` so tsx forwards it to the watched process rather than the supervisor.
	//
	// `--include` also watches the esbuild-bundled thread entrypoints: tsx only watches its own
	// import graph, and the thread bundles are not in it, so without this a change to thread code
	// would rebuild the bundle but never restart the backend that spawns those threads. The glob is
	// passed interpolated so zx quotes it (the shell must not expand it - tsx expands it itself).
	const threadBundleGlob = path.join(devThreadOutDir, '*.js')
	const proc = $({
		cwd: path.join(import.meta.dirname, '../companion'),
		stdio: 'inherit',
		env: {
			...process.env,

			NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --conditions=companion:source`.trim(),
			COMPANION_DEV_MODULES: '1',
			COMPANION_DEV_MODULES_PATH: devModulesPath ?? '',
			COMPANION_DEV_THREAD_DIR: devThreadOutDir,
		},
	})`tsx watch --clear-screen=false --include ${threadBundleGlob} ${nodeArgs} lib/main-dev.ts ${process.argv.slice(2)}`

	node = proc.child ?? null

	// tsx watch exiting means the dev session is over (e.g. Ctrl-C); mirror its exit code.
	proc.then(
		(r) => process.exit(r.exitCode ?? 0),
		(r) => process.exit(r?.exitCode ?? 1)
	)
}

function signalHandler(_signal: NodeJS.Signals) {
	if (node) node.kill()
	process.exit()
}

// Make sure to exit on interrupt
process.on('SIGINT', signalHandler)
process.on('SIGTERM', signalHandler)
process.on('SIGQUIT', signalHandler)

console.log('Starting application')
start()
