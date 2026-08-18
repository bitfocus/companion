import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { initTRPC, type TRPCRouterCaller } from '@trpc/server'
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

/**
 * Boot a real Companion application for an integration test
 */
export async function createTestApp(options: TestAppOptions): Promise<TestApp> {
	// The webui static-file server refuses to start without a build output directory. An empty
	// directory satisfies it (the directory is gitignored)
	fs.mkdirSync(path.join(import.meta.dirname, '../../../webui/build'), { recursive: true })

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
	// Tests should drive `http` (supertest against the express app) rather than this socket
	const httpPort = 20000 + Math.floor(Math.random() * 40000)
	await registry.ready('', '127.0.0.1', httpPort)

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
