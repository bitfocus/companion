import { exec } from 'node:child_process'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import { promisify } from 'node:util'
import fs from 'fs-extra'
import pDebounce from 'p-debounce'
import { UdevRuleGenerator, type UdevRuleDefinition } from 'udev-generator'
import type { UdevRulesStatus } from '@companion-app/shared/Model/Common.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import LogController from '../Log/Controller.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'

const defaultExecAsync = promisify(exec)

const UDEV_RULES_FILENAME_DESKTOP = '50-companion-desktop.rules'
const UDEV_RULES_FILENAME_HEADLESS = '50-companion-headless.rules'
const DEFAULT_SYSTEM_UDEV_RULES_DIR = '/etc/udev/rules.d'

/** A subset of `promisify(child_process.exec)`, injectable for testing */
export type ExecAsyncFn = (command: string) => Promise<{ stdout: string; stderr: string }>

export interface InstanceUdevRulesControllerOptions {
	/**
	 * Whether this is the desktop (electron) build, which can apply rules itself via pkexec.
	 * Defaults to the `COMPANION_IPC_PARENT` env var being set (the electron launcher sets it).
	 */
	isDesktopBuild?: boolean
	/**
	 * A command to run to apply the rules automatically whenever they change (used by the headless tooling).
	 * Defaults to the `COMPANION_SYNC_UDEV_RULES_COMMAND` env var.
	 */
	syncCommand?: string | undefined
	/** The current platform. Defaults to `process.platform`. */
	platform?: NodeJS.Platform
	/** The directory the rules must be installed to. Defaults to `/etc/udev/rules.d`. */
	systemRulesDir?: string
	/** Runs a shell command. Injectable for testing. */
	execAsync?: ExecAsyncFn
}

interface InstanceUdevRulesEvents {
	status: [status: UdevRulesStatus]
}

/** Wrap a string in single quotes for safe use in a `sh -c` command */
function singleQuote(str: string): string {
	return `'${str.replace(/'/g, `'\\''`)}'`
}

/**
 * Manages the Linux udev rules that grant access to USB surfaces.
 *
 * Since 4.3 surfaces are modules, so the required USB ids change as modules are enabled/disabled and
 * we cannot ship a static rules file. This regenerates the rules on the fly, tracks whether the installed
 * copy is out of date, and (on the desktop build) can apply them via pkexec.
 */
export class InstanceUdevRulesController extends EventEmitter<InstanceUdevRulesEvents> {
	readonly #logger = LogController.createLogger('Instance/UdevRules')

	readonly #udevRulesDir: string
	/** Gathers the USB ids of all enabled surface modules, used to generate the rules */
	readonly #collectSurfaceUsbIds: () => UdevRuleDefinition[]

	readonly #isDesktopBuild: boolean
	readonly #syncCommand: string | undefined
	readonly #platform: NodeJS.Platform
	readonly #systemRulesDir: string
	readonly #execAsync: ExecAsyncFn

	#lastStatus: UdevRulesStatus | null = null
	#pkexecAvailablePromise: Promise<boolean> | null = null

	constructor(
		udevRulesDir: string,
		collectSurfaceUsbIds: () => UdevRuleDefinition[],
		options: InstanceUdevRulesControllerOptions = {}
	) {
		super()
		this.setMaxListeners(0)

		this.#udevRulesDir = udevRulesDir
		this.#collectSurfaceUsbIds = collectSurfaceUsbIds

		this.#isDesktopBuild = options.isDesktopBuild ?? !!process.env.COMPANION_IPC_PARENT
		this.#syncCommand = options.syncCommand ?? process.env.COMPANION_SYNC_UDEV_RULES_COMMAND
		this.#platform = options.platform ?? process.platform
		this.#systemRulesDir = options.systemRulesDir ?? DEFAULT_SYSTEM_UDEV_RULES_DIR
		this.#execAsync = options.execAsync ?? defaultExecAsync
	}

	/** Trigger a (debounced) regeneration of the udev rules. Safe to call on any platform. */
	triggerRegenerate = (): void => {
		if (this.#platform !== 'linux') return
		this.#regenerate().catch((e) => {
			this.#logger.warn(`Error regenerating udev rules: `, e)
		})
	}

	#regenerate = pDebounce(
		async () => {
			if (this.#platform !== 'linux') return

			this.#logger.info('Regenerating udev rules for surface modules')

			const generator = new UdevRuleGenerator()
			generator.addRules(this.#collectSurfaceUsbIds())

			const desktopFile = generator.generateFile({ mode: 'desktop' })
			const headlessFile = generator.generateFile({ mode: 'headless', userGroup: 'companion' })

			await fs.mkdirp(this.#udevRulesDir)

			// Read existing files to check for changes
			const headlessPath = path.join(this.#udevRulesDir, UDEV_RULES_FILENAME_HEADLESS)
			const desktopPath = path.join(this.#udevRulesDir, UDEV_RULES_FILENAME_DESKTOP)

			const [existingHeadless, existingDesktop] = await Promise.all([
				fs.readFile(headlessPath, 'utf8').catch(() => ''),
				fs.readFile(desktopPath, 'utf8').catch(() => ''),
			])

			// Only write files if they have changed
			let hasChanges = false
			if (existingHeadless !== headlessFile) {
				await fs.writeFile(headlessPath, headlessFile, 'utf8')
				hasChanges = true
			}
			if (existingDesktop !== desktopFile) {
				await fs.writeFile(desktopPath, desktopFile, 'utf8')
				hasChanges = true
			}

			if (hasChanges) {
				this.#logger.debug('Udev rules for surface modules regenerated')

				// If setup, run the sync command to apply the new rules
				if (this.#syncCommand) {
					try {
						this.#logger.info(`Running udev sync command: ${this.#syncCommand}`)
						await this.#execAsync(this.#syncCommand)
						this.#logger.info('Udev rules synced successfully')
					} catch (e) {
						this.#logger.error(`Failed to sync udev rules: ${stringifyError(e)}`)
					}
				}
			} else {
				this.#logger.debug('Udev rules unchanged, skipping regeneration')
			}

			// Recompute whether the rules need applying, so the UI can prompt if needed
			await this.#refreshStatus()
		},
		50,
		{
			before: false,
		}
	)

	/**
	 * Compute the current status of the udev rules for the active build (desktop or headless).
	 * Compares the generated rules file against the copy installed in the system rules directory.
	 */
	async #computeStatus(): Promise<UdevRulesStatus> {
		const mode = this.#isDesktopBuild ? 'desktop' : 'headless'
		const filename = this.#isDesktopBuild ? UDEV_RULES_FILENAME_DESKTOP : UDEV_RULES_FILENAME_HEADLESS
		const generatedPath = path.join(this.#udevRulesDir, filename)
		const installedPath = path.join(this.#systemRulesDir, filename)
		const applyCommand = `sudo cp ${singleQuote(generatedPath)} ${singleQuote(installedPath)} && sudo udevadm control --reload-rules && sudo udevadm trigger`

		// canAutoApply is overridden per-connection in the subscription
		const base: UdevRulesStatus = {
			supported: this.#platform === 'linux',
			mode,
			needsApply: false,
			generatedPath,
			installedPath,
			applyCommand,
			canAutoApply: false,
		}

		if (!base.supported) return base

		const [generated, installed] = await Promise.all([
			fs.readFile(generatedPath, 'utf8').catch(() => ''),
			fs.readFile(installedPath, 'utf8').catch(() => ''),
		])

		// The generator always emits a header line; only device-specific (hidraw) rules require action
		const hasDeviceRules = generated.includes('hidraw')
		base.needsApply = hasDeviceRules && installed !== generated

		return base
	}

	/** Recompute and broadcast the udev rules status */
	#refreshStatus = async (): Promise<void> => {
		try {
			const status = await this.#computeStatus()
			this.#lastStatus = status
			this.emit('status', status)
		} catch (e) {
			this.#logger.warn(`Error computing udev rules status: `, e)
		}
	}

	/** Get the current udev rules status, computing it if not yet cached */
	async #getStatus(): Promise<UdevRulesStatus> {
		if (!this.#lastStatus) {
			this.#lastStatus = await this.#computeStatus()
		}
		return this.#lastStatus
	}

	/** Whether the `pkexec` command is available, used for one-click applying of udev rules */
	async #isPkexecAvailable(): Promise<boolean> {
		if (!this.#pkexecAvailablePromise) {
			this.#pkexecAvailablePromise = this.#execAsync('command -v pkexec')
				.then(() => true)
				.catch(() => false)
		}
		return this.#pkexecAvailablePromise
	}

	/**
	 * Whether Companion can apply the udev rules itself for this client.
	 * Only on the desktop build, on linux, with pkexec available, and when the client is on the same machine
	 * (the graphical pkexec prompt only appears on the host's own display).
	 */
	async #canAutoApply(isLocalClient: boolean): Promise<boolean> {
		if (this.#platform !== 'linux' || !this.#isDesktopBuild || !isLocalClient) return false
		return this.#isPkexecAvailable()
	}

	/** Apply the generated udev rules using pkexec. Caller must verify the client is permitted. */
	async #applyRules(): Promise<void> {
		const status = await this.#getStatus()

		const inner = `cp ${singleQuote(status.generatedPath)} ${singleQuote(status.installedPath)} && udevadm control --reload-rules && udevadm trigger`
		const command = `pkexec sh -c ${singleQuote(inner)}`

		this.#logger.info('Applying udev rules via pkexec')
		await this.#execAsync(command)
		this.#logger.info('Udev rules applied successfully')

		await this.#refreshStatus()
	}

	createTrpcRouter() {
		const self = this
		const selfEvents: EventEmitter<InstanceUdevRulesEvents> = this

		return router({
			status: publicProcedure.subscription(async function* ({ signal, ctx }) {
				// canAutoApply depends on the connecting client, so decorate the shared status per-connection
				const decorate = async (status: UdevRulesStatus): Promise<UdevRulesStatus> => ({
					...status,
					canAutoApply: await self.#canAutoApply(ctx.isLocalClient()),
				})

				yield await decorate(await self.#getStatus())

				const changes = toIterable(selfEvents, 'status', signal)
				for await (const [status] of changes) {
					yield await decorate(status)
				}
			}),

			recheck: publicProcedure.mutation(async () => {
				await self.#refreshStatus()
			}),

			applyRules: publicProcedure.mutation(async ({ ctx }) => {
				if (!(await self.#canAutoApply(ctx.isLocalClient()))) {
					throw new Error('USB permissions can only be applied automatically from the machine running Companion')
				}

				try {
					await self.#applyRules()
				} catch (e) {
					throw new Error(`Failed to apply USB permissions: ${stringifyError(e)}`)
				}
			}),
		})
	}
}
