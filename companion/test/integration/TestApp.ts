import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { initTRPC, type TRPCRouterCaller } from '@trpc/server'
import type { BuildOptions } from 'esbuild'
import supertest from 'supertest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import {
	EntityModelType,
	type EntityOwner,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import type { VariableValue } from '@companion-app/shared/Model/Variables.js'
import type { Registry } from '../../lib/Registry.js'
import type { AppRouter, TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext } from '../Util.js'

// The graphics controller reads this at module load, so it must be set before the Registry module
// graph is imported - which is why the app modules below are imported dynamically inside
// createTestApp rather than statically
process.env.DEBUG_DISABLE_RENDER_THREADING = '1'
// Bind the network services to ipv4 - tests connect via 127.0.0.1, and some sandboxed
// environments have no ipv6 at all (binding '::' fails with EAFNOSUPPORT)
process.env.DISABLE_IPV6 = '1'

// Explicit annotations - the inferred types are too large for declaration emit to serialize
type AppRouterCallerFactory = TRPCRouterCaller<AppRouter['_def']['_config']['$types'], AppRouter['_def']['record']>

// A local trpc instance is enough to build a caller for the real router - the middleware lives on
// the procedures themselves (this mirrors how the unit tests call trpc routers)
function createTrpcCallerFactory(trpcRouter: AppRouter): AppRouterCallerFactory {
	const t = initTRPC.context<TrpcContext>().create()
	return t.createCallerFactory(trpcRouter)
}

export type TestAppTrpcCaller = ReturnType<AppRouterCallerFactory>

export interface TestAppOptions {
	/**
	 * Config directory to boot from. Pass the `configDir` of a previous (closed) TestApp to test
	 * restart/persistence behaviour, or null for a fresh temporary directory
	 */
	configDir: string | null
	/**
	 * Directory of dev connection/surface modules to load (each direct child a module directory),
	 * or null for none. When set, the fixture also provisions the node runtimes and thread bundles
	 * needed to spawn real module child processes
	 */
	extraModulePath: string | null
}

/**
 * A real Companion application booted for integration tests: the full Registry on a temporary
 * config directory, with rendering in-process and no module child processes or usb/hotplug/mdns
 * side effects (disabled via seeded userconfig).
 *
 * Always `close()` the app when the test is done, so no timers or sockets leak between tests.
 */
export interface TestApp {
	readonly registry: Registry
	readonly configDir: string
	/** supertest agent driving the real express app (no listening socket needed) */
	readonly http: ReturnType<typeof supertest>
	/** The port the real http server is listening on (for tests that need a real browser/socket) */
	readonly httpPort: number

	/**
	 * Build an in-process caller for the real trpc router, to drive the app the way the webui does.
	 * Pass a ctx to share state between calls (e.g. `pendingImport` for imports); defaults to a fresh
	 * local-client mock context
	 */
	trpc(ctx?: TrpcContext): TestAppTrpcCaller

	/** Create a button control at a grid location, returning its controlId */
	createButton(location: ControlLocation): string
	/** Add an action from the internal connection to the first step's 'down' set of a button */
	addInternalAction(controlId: string, definitionId: string, options: Record<string, ExpressionOrValue<any>>): string
	/** Add a child action under a parent entity (e.g. into a logic_if group) in the first step's 'down' set */
	addInternalChildAction(
		controlId: string,
		owner: EntityOwner,
		definitionId: string,
		options: Record<string, ExpressionOrValue<any>>
	): string
	/** Add an action from the internal connection to the 'down' set of a specific step of a button */
	addInternalActionToStep(
		controlId: string,
		stepId: string,
		definitionId: string,
		options: Record<string, ExpressionOrValue<any>>
	): string
	/** Add an action from the internal connection to a trigger's action list */
	addTriggerAction(controlId: string, definitionId: string, options: Record<string, ExpressionOrValue<any>>): string
	/** Add a feedback from the internal connection to a button (or a trigger, where it becomes a condition) */
	addInternalFeedback(controlId: string, definitionId: string, options: Record<string, ExpressionOrValue<any>>): string
	/** Add a child feedback under a parent entity (e.g. a logic_if condition) in the first step's 'down' set */
	addInternalChildFeedback(
		controlId: string,
		owner: EntityOwner,
		definitionId: string,
		options: Record<string, ExpressionOrValue<any>>
	): string
	/** Read the current cached value of a feedback entity on a control */
	getFeedbackValue(controlId: string, entityId: string): any
	/** Press or release the button at a grid location */
	pressButton(location: ControlLocation, pressed: boolean): void
	/** Create a custom variable, throwing on failure */
	createCustomVariable(name: string, defaultValue: VariableValue | undefined): void
	/** Read the current value of a custom variable */
	getCustomVariableValue(name: string): VariableValue | undefined

	/** Shut the application down gracefully. The config directory is left in place for reuse */
	close(): Promise<void>
}

/** Marks a stubbed runtime directory - keep in sync with STUB_RUNTIME_MARKER in tools/fetch_nodejs.mts */
const STUB_RUNTIME_MARKER = '.companion-test-stub'

/**
 * Runtime names (e.g. 'node18') whose binaries are stubbed with the node running the tests instead
 * of the real pinned runtime. Populated by prepareForModuleChildren - tests must skip any assertion
 * about the child's true node version for these
 */
export const stubbedNodeRuntimes = new Set<string>()

/**
 * Provision what spawning real module child processes needs: node binaries at the paths the host
 * resolves runtimes from, and the bundled thread entrypoints that api-2.x modules run under (built
 * the same way `yarn dev` builds them).
 *
 * The real pinned runtimes are downloaded via `yarn fetch-runtimes` (the same script `yarn dev` and
 * packaging run), so a module declaring node18 really spawns on node18. Only when that download is
 * impossible (e.g. offline) is a runtime stubbed with a link to the node running the tests - which
 * can misbehave (the host tailors spawn arguments to the declared runtime), so on CI a missing
 * runtime is an error instead.
 */
const prepareForModuleChildren = (() => {
	let prepared: Promise<void> | null = null
	return async (): Promise<void> => {
		prepared ??= (async () => {
			const repoRoot = path.join(import.meta.dirname, '../../..')

			const nodeVersions = JSON.parse(
				fs.readFileSync(path.join(repoRoot, 'assets/nodejs-versions.json'), 'utf8')
			) as Record<string, string>
			const runtimePaths = Object.entries(nodeVersions).map(([runtimeName, versionNumber]) => {
				const runtimeDir = path.join(
					repoRoot,
					'.cache/node-runtime',
					`${process.platform}-${process.arch}-${versionNumber}`
				)
				return {
					runtimeName,
					versionNumber,
					runtimeDir,
					nodePath:
						process.platform === 'win32' ? path.join(runtimeDir, 'node.exe') : path.join(runtimeDir, 'bin/node'),
				}
			})

			const isMissingOrStub = (runtime: (typeof runtimePaths)[0]): boolean =>
				!fs.existsSync(runtime.nodePath) || fs.existsSync(path.join(runtime.runtimeDir, STUB_RUNTIME_MARKER))

			if (runtimePaths.some(isMissingOrStub)) {
				// Download the real runtimes (this also replaces stubs left by an earlier offline run)
				try {
					execSync('yarn fetch-runtimes', { cwd: repoRoot, stdio: 'inherit' })
				} catch (e) {
					console.warn(`Fetching the module node runtimes failed: ${e}`)
				}
			}

			const stubbed: string[] = []
			for (const runtime of runtimePaths) {
				if (!isMissingOrStub(runtime)) continue

				if (process.env.CI)
					throw new Error(
						`Node.js runtime ${runtime.runtimeName} (${runtime.versionNumber}) is missing from .cache/node-runtime ` +
							`and could not be fetched. Stubbing it with the test host's node would hide node-version incompatibilities`
					)

				if (!fs.existsSync(runtime.nodePath)) {
					fs.mkdirSync(path.dirname(runtime.nodePath), { recursive: true })
					fs.writeFileSync(path.join(runtime.runtimeDir, STUB_RUNTIME_MARKER), '')
					try {
						fs.symlinkSync(process.execPath, runtime.nodePath)
					} catch (_e) {
						// Symlinks can need privileges on windows - fall back to a copy
						fs.copyFileSync(process.execPath, runtime.nodePath)
					}
				}
				stubbedNodeRuntimes.add(runtime.runtimeName)
				stubbed.push(`${runtime.runtimeName} (${runtime.versionNumber})`)
			}
			if (stubbed.length > 0) {
				console.warn(
					`Module runtimes ${stubbed.join(', ')} are stubbed with the test host's node ${process.versions.node}. ` +
						`Modules declaring them may not behave as they would on the real runtime.`
				)
			}

			// Bundle the thread entrypoints exactly as `yarn dev` does (tools/build_dev_threads.mts),
			// but as a one-shot build instead of a watcher. The tools workspace has its own tsconfig,
			// so its config is imported opaquely rather than type-checked from this project
			const esbuild = await import('esbuild')
			const esbuildConfigPath = path.join(repoRoot, 'tools/companion-esbuild.mts')
			const { companionEsbuildBaseOptions, companionThreadEntryPoints } = (await import(esbuildConfigPath)) as {
				companionEsbuildBaseOptions: (opts: { packaged: boolean }) => BuildOptions
				companionThreadEntryPoints: { in: string; out: string; target: 'node22' | 'node26' }[]
			}
			const companionDir = path.join(repoRoot, 'companion')
			const outDir = path.join(companionDir, 'dist', 'threads')
			for (const target of new Set(companionThreadEntryPoints.map((e) => e.target))) {
				await esbuild.build({
					...companionEsbuildBaseOptions({ packaged: false }),
					absWorkingDir: companionDir,
					outdir: outDir,
					target,
					entryPoints: companionThreadEntryPoints
						.filter((e) => e.target === target)
						.map(({ in: input, out }) => ({ in: input, out })),
					plugins: [
						{
							name: 'externalize-node-modules',
							setup(build) {
								build.onResolve({ filter: /^[^./]/ }, (args) => {
									if (args.path === '@companion-app/shared' || args.path.startsWith('@companion-app/shared/'))
										return null
									return { path: args.path, external: true }
								})
							},
						},
					],
				})
			}
			process.env.COMPANION_DEV_THREAD_DIR = outDir
		})()
		await prepared
	}
})()

/**
 * Boot a real Companion application for an integration test
 */
export async function createTestApp(options: TestAppOptions): Promise<TestApp> {
	// The webui static-file server refuses to start without a build output directory. An empty
	// directory satisfies it (the directory is gitignored)
	fs.mkdirSync(path.join(import.meta.dirname, '../../../webui/build'), { recursive: true })

	if (options.extraModulePath) await prepareForModuleChildren()

	const isFreshConfigDir = options.configDir === null
	const configDir = options.configDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'companion-test-'))

	const modulesDir = path.join(configDir, 'modules')
	const surfaceModulesDir = path.join(configDir, 'surfaces')
	const builtinSurfaceModulesDir = path.join(configDir, 'builtin-surfaces')
	const udevRulesDir = path.join(configDir, 'udev-rules')
	fs.mkdirSync(builtinSurfaceModulesDir, { recursive: true })

	if (isFreshConfigDir) {
		// Seed the database before the Registry opens it, for two reasons: the userconfig overrides
		// below must be in place before the controllers read them at construction, and a pre-existing
		// database means the boot is not treated as a first run (which would register the builtin
		// surface module instances and try to start them as child processes)
		const { DataDatabase } = await import('../../lib/Data/Database.js')
		const { DataUserConfig } = await import('../../lib/Data/UserConfig.js')

		const seedDb = new DataDatabase(configDir, () => {})
		seedDb.defaultTableView.set('userconfig', {
			...structuredClone(DataUserConfig.Defaults),
			// Don't register a usb hotplug listener (a native handle that would outlive the test)
			usb_hotplug: false,
			// Don't report usage statistics
			detailed_data_collection: false,
			// Don't announce over mdns
			mdns_announcements_enabled: false,
			// Mark the setup wizard as already completed (WIZARD_CURRENT_VERSION in
			// webui/src/Wizard/Constants.ts), so it doesn't block the ui in browser tests
			setup_wizard: 50,
		})
		seedDb.close()
	}

	const { Registry } = await import('../../lib/Registry.js')
	const { createTrpcRouter } = await import('../../lib/UI/TRPC.js')

	const registry = new Registry(
		{
			configDir,
			logsDir: undefined,
			modulesDirs: {
				[ModuleInstanceType.Connection]: modulesDir,
				[ModuleInstanceType.Surface]: surfaceModulesDir,
			},
			builtinModuleDirs: {
				[ModuleInstanceType.Connection]: null,
				[ModuleInstanceType.Surface]: builtinSurfaceModulesDir,
			},
			udevRulesDir,
			machineId: 'test-machine-id',
			options: {
				notifications: false,
				enableShellCommandSupport: false,
				enableRestrictedModules: false,
				trustedProxies: undefined,
				installNameOverride: undefined,
			},
		},
		(restart) => {
			throw new Error(`Unexpected process exit requested by Registry (restart: ${restart})`)
		}
	)

	// Stub out the update check - ready() would otherwise fire a real request at the updates server
	registry.ui.update.startCycle = () => {}

	// The http port is bound for real, so randomise it to keep parallel test files from colliding.
	// Most tests should drive `http` (supertest against the express app) rather than this socket
	const randomPort = () => 20000 + Math.floor(Math.random() * 40000)
	await registry.ready(options.extraModulePath ?? '', '127.0.0.1', randomPort())

	// ready() does not await the listen call, so wait for the server before reading the bound port.
	// A random port is not guaranteed to be bindable (windows reserves blocks of this range and
	// denies them with EACCES, and another process can hold one), so retry with a fresh port
	const awaitListenOutcome = async (): Promise<number | null> =>
		new Promise<number | null>((resolve, reject) => {
			const server = registry.ui.server
			const cleanup = () => {
				server.off('listening', onListening)
				server.off('error', onError)
				clearTimeout(timeout)
			}
			const onListening = () => {
				cleanup()
				const address = server.address()
				if (address && typeof address === 'object') resolve(address.port)
				else reject(new Error('Failed to determine bound http port'))
			}
			const onError = (e: NodeJS.ErrnoException) => {
				cleanup()
				if (e.code === 'EACCES' || e.code === 'EADDRINUSE') resolve(null)
				else reject(e)
			}
			// The error can fire before these listeners attach (rebindHttp swallows it into a log), so
			// a quiet server that never reaches listening also counts as a failed attempt
			const timeout = setTimeout(() => {
				cleanup()
				resolve(null)
			}, 10_000)
			server.on('listening', onListening)
			server.on('error', onError)
			if (server.listening) onListening()
		})

	let httpPort: number | null = await awaitListenOutcome()
	for (let attempt = 0; httpPort === null && attempt < 10; attempt++) {
		registry.rebindHttp('127.0.0.1', randomPort())
		httpPort = await awaitListenOutcome()
	}
	if (httpPort === null) throw new Error('Failed to bind the http server to a free port')

	// Building a second router for in-process calls is safe - ready() already bound its own copy to
	// the websocket handler, and the router builders are side-effect free
	const trpcCallerFactory = createTrpcCallerFactory(createTrpcRouter(registry))

	const getEditableEntities = (controlId: string) => {
		const control = registry.controls.getControl(controlId)
		if (!control) throw new Error(`Control "${controlId}" does not exist`)
		if (!control.supportsEntities || !control.entities.isEditable)
			throw new Error(`Control "${controlId}" does not support editing entities`)
		return control.entities
	}

	const addInternalEntity = (
		controlId: string,
		listId: SomeSocketEntityLocation,
		owner: EntityOwner | null,
		entityType: EntityModelType,
		definitionId: string,
		options: Record<string, ExpressionOrValue<any>>
	): string => {
		const entities = getEditableEntities(controlId)

		const entityModel = registry.instance.definitions.createEntityItem('internal', entityType, definitionId, null)
		if (!entityModel) throw new Error(`Unknown internal ${entityType} definition "${definitionId}"`)
		Object.assign(entityModel.options, options)

		if (!entities.entityAdd(listId, owner, entityModel))
			throw new Error(`Failed to add ${entityType} to "${controlId}"`)

		return entityModel.id
	}

	const firstDownSet = (controlId: string): SomeSocketEntityLocation => {
		// Only the button pool has steps, which the EditableEntityListPool interface doesn't expose
		const entities = getEditableEntities(controlId) as unknown as { getStepIds?: () => string[] }
		if (typeof entities.getStepIds !== 'function') throw new Error(`Control "${controlId}" does not have steps`)
		return { stepId: entities.getStepIds()[0], setId: 'down' }
	}

	return {
		registry,
		configDir,
		http: supertest(registry.ui.express.app),
		httpPort,

		trpc(ctx?: TrpcContext) {
			return trpcCallerFactory(ctx ?? createMockTrpcContext())
		},

		createButton(location) {
			const controlId = registry.controls.createButtonControl(location, 'button-layered')
			if (!controlId)
				throw new Error(`Failed to create button at ${location.pageNumber}/${location.row}/${location.column}`)
			return controlId
		},

		addInternalAction(controlId, definitionId, options) {
			return addInternalEntity(controlId, firstDownSet(controlId), null, EntityModelType.Action, definitionId, options)
		},

		addInternalChildAction(controlId, owner, definitionId, options) {
			return addInternalEntity(controlId, firstDownSet(controlId), owner, EntityModelType.Action, definitionId, options)
		},

		addInternalActionToStep(controlId, stepId, definitionId, options) {
			return addInternalEntity(
				controlId,
				{ stepId, setId: 'down' },
				null,
				EntityModelType.Action,
				definitionId,
				options
			)
		},

		addTriggerAction(controlId, definitionId, options) {
			return addInternalEntity(controlId, 'trigger_actions', null, EntityModelType.Action, definitionId, options)
		},

		addInternalFeedback(controlId, definitionId, options) {
			return addInternalEntity(controlId, 'feedbacks', null, EntityModelType.Feedback, definitionId, options)
		},

		addInternalChildFeedback(controlId, owner, definitionId, options) {
			return addInternalEntity(
				controlId,
				firstDownSet(controlId),
				owner,
				EntityModelType.Feedback,
				definitionId,
				options
			)
		},

		getFeedbackValue(controlId, entityId) {
			const entities = getEditableEntities(controlId)
			const entity = entities.findEntityById(entityId)
			if (!entity) throw new Error(`Entity "${entityId}" does not exist on "${controlId}"`)
			return entity.feedbackValue
		},

		pressButton(location, pressed) {
			const controlId = registry.page.store.getControlIdAt(location)
			if (!controlId) throw new Error(`No control at ${location.pageNumber}/${location.row}/${location.column}`)
			registry.controls.pressControl(controlId, pressed, 'test-surface')
		},

		createCustomVariable(name, defaultValue) {
			const failureReason = registry.variables.custom.createVariable(name, defaultValue)
			if (failureReason) throw new Error(failureReason)
		},

		getCustomVariableValue(name) {
			return registry.variables.custom.getValue(name)
		},

		async close() {
			await registry.close()
		},
	}
}
