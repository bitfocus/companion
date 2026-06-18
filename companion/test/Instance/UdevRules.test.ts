import os from 'node:os'
import path from 'node:path'
import { initTRPC } from '@trpc/server'
import fs from 'fs-extra'
import type { UdevRuleDefinition } from 'udev-generator'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	InstanceUdevRulesController,
	type ExecAsyncFn,
	type InstanceUdevRulesControllerOptions,
} from '../../lib/Instance/UdevRules.js'
import type { TrpcContext } from '../../lib/UI/TRPC.js'
import { createMockTrpcContext, SuppressLogging } from '../Util.js'
import { SubscriptionTester } from '../utils/SubscriptionTester.js'

const HEADLESS_FILENAME = '50-companion-headless.rules'
const DESKTOP_FILENAME = '50-companion-desktop.rules'
const SAMPLE_RULES = 'KERNEL=="hidraw*", ATTRS{idVendor}=="1234", ATTRS{idProduct}=="5678", MODE:="660"\n'

const t = initTRPC.context<TrpcContext>().create()

const tempDirs: string[] = []
afterEach(async () => {
	vi.restoreAllMocks()
	await Promise.all(tempDirs.splice(0).map((dir) => fs.remove(dir).catch(() => null)))
})

async function setup(options: Partial<InstanceUdevRulesControllerOptions> & { usbIds?: UdevRuleDefinition[] } = {}) {
	const { usbIds, ...controllerOptions } = options

	const generatedDir = await fs.mkdtemp(path.join(os.tmpdir(), 'companion-udev-gen-'))
	const systemDir = await fs.mkdtemp(path.join(os.tmpdir(), 'companion-udev-sys-'))
	tempDirs.push(generatedDir, systemDir)

	const execAsync = vi.fn<ExecAsyncFn>().mockResolvedValue({ stdout: '', stderr: '' })

	const controller = new InstanceUdevRulesController(
		generatedDir,
		() => usbIds ?? [{ vendorId: 0x1234, productIds: [0x5678] }],
		{
			platform: 'linux',
			isDesktopBuild: false,
			systemRulesDir: systemDir,
			execAsync,
			...controllerOptions,
		}
	)

	return { controller, generatedDir, systemDir, execAsync }
}

/** Read the first status value yielded by the `status` subscription */
async function readStatus(controller: InstanceUdevRulesController, ctx: TrpcContext = createMockTrpcContext()) {
	const caller = t.createCallerFactory(controller.createTrpcRouter())(ctx)
	const sub = new SubscriptionTester(await caller.status())
	try {
		return await sub.next()
	} finally {
		await sub.cleanup()
	}
}

describe('InstanceUdevRulesController', () => {
	SuppressLogging()

	describe('status', () => {
		it('reports needsApply when the installed rules are missing', async () => {
			const { controller, generatedDir } = await setup()
			await fs.writeFile(path.join(generatedDir, HEADLESS_FILENAME), SAMPLE_RULES)

			const status = await readStatus(controller)

			expect(status.supported).toBe(true)
			expect(status.mode).toBe('headless')
			expect(status.needsApply).toBe(true)
			expect(status.generatedPath).toBe(path.join(generatedDir, HEADLESS_FILENAME))
		})

		it('reports needsApply when the installed rules differ', async () => {
			const { controller, generatedDir, systemDir } = await setup()
			await fs.writeFile(path.join(generatedDir, HEADLESS_FILENAME), SAMPLE_RULES)
			await fs.writeFile(path.join(systemDir, HEADLESS_FILENAME), 'KERNEL=="hidraw*", something-stale\n')

			const status = await readStatus(controller)
			expect(status.needsApply).toBe(true)
		})

		it('does not need applying when the installed rules already match', async () => {
			const { controller, generatedDir, systemDir } = await setup()
			await fs.writeFile(path.join(generatedDir, HEADLESS_FILENAME), SAMPLE_RULES)
			await fs.writeFile(path.join(systemDir, HEADLESS_FILENAME), SAMPLE_RULES)

			const status = await readStatus(controller)
			expect(status.needsApply).toBe(false)
		})

		it('does not need applying when there are no device rules', async () => {
			const { controller, generatedDir } = await setup()
			// A file with only the header line (no hidraw device rules)
			await fs.writeFile(path.join(generatedDir, HEADLESS_FILENAME), 'SUBSYSTEM=="input", GROUP="input"\n')

			const status = await readStatus(controller)
			expect(status.needsApply).toBe(false)
		})

		it('does not need applying when a sync command is configured', async () => {
			// The sync command installs the rules to its own location, so the system rules dir comparison
			// would always report a false mismatch. With a sync command set, the check is skipped entirely.
			const { controller, generatedDir } = await setup({ syncCommand: 'my-sync-command' })
			await fs.writeFile(path.join(generatedDir, HEADLESS_FILENAME), SAMPLE_RULES)

			const status = await readStatus(controller)
			expect(status.needsApply).toBe(false)
		})

		it('uses the desktop file for the desktop build', async () => {
			const { controller, generatedDir } = await setup({ isDesktopBuild: true })
			await fs.writeFile(path.join(generatedDir, DESKTOP_FILENAME), SAMPLE_RULES)

			const status = await readStatus(controller)
			expect(status.mode).toBe('desktop')
			expect(status.generatedPath).toBe(path.join(generatedDir, DESKTOP_FILENAME))
			expect(status.needsApply).toBe(true)
		})

		it('is not supported on a non-linux platform', async () => {
			const { controller, generatedDir } = await setup({ platform: 'darwin' })
			await fs.writeFile(path.join(generatedDir, HEADLESS_FILENAME), SAMPLE_RULES)

			const status = await readStatus(controller)
			expect(status.supported).toBe(false)
			expect(status.needsApply).toBe(false)
		})
	})

	describe('canAutoApply', () => {
		async function readCanAutoApply(
			options: Partial<InstanceUdevRulesControllerOptions>,
			ctx: TrpcContext
		): Promise<boolean> {
			const { controller, generatedDir } = await setup(options)
			await fs.writeFile(
				path.join(generatedDir, options.isDesktopBuild ? DESKTOP_FILENAME : HEADLESS_FILENAME),
				SAMPLE_RULES
			)
			const status = await readStatus(controller, ctx)
			return status.canAutoApply
		}

		it('is true on the desktop build for a local client with pkexec available', async () => {
			expect(
				await readCanAutoApply({ isDesktopBuild: true }, createMockTrpcContext({ isLocalClient: () => true }))
			).toBe(true)
		})

		it('is false for a remote client', async () => {
			expect(
				await readCanAutoApply({ isDesktopBuild: true }, createMockTrpcContext({ isLocalClient: () => false }))
			).toBe(false)
		})

		it('is false on the headless build', async () => {
			expect(
				await readCanAutoApply({ isDesktopBuild: false }, createMockTrpcContext({ isLocalClient: () => true }))
			).toBe(false)
		})

		it('is false when pkexec is not available', async () => {
			const { controller, generatedDir } = await setup({
				isDesktopBuild: true,
				execAsync: vi.fn<ExecAsyncFn>().mockRejectedValue(new Error('not found')),
			})
			await fs.writeFile(path.join(generatedDir, DESKTOP_FILENAME), SAMPLE_RULES)

			const status = await readStatus(controller, createMockTrpcContext({ isLocalClient: () => true }))
			expect(status.canAutoApply).toBe(false)
		})
	})

	describe('apply', () => {
		it('runs pkexec to install and reload the rules for a permitted client', async () => {
			const { controller, generatedDir, systemDir, execAsync } = await setup({ isDesktopBuild: true })
			await fs.writeFile(path.join(generatedDir, DESKTOP_FILENAME), SAMPLE_RULES)

			const caller = t.createCallerFactory(controller.createTrpcRouter())(
				createMockTrpcContext({ isLocalClient: () => true })
			)
			await caller.applyRules()

			const pkexecCall = execAsync.mock.calls.map((c) => c[0]).find((cmd) => cmd.includes('pkexec sh -c'))
			expect(pkexecCall).toBeDefined()
			expect(pkexecCall).toContain(path.join(generatedDir, DESKTOP_FILENAME))
			expect(pkexecCall).toContain(path.join(systemDir, DESKTOP_FILENAME))
			expect(pkexecCall).toContain('udevadm control --reload-rules')
		})

		it('rejects when the client is not on the same machine', async () => {
			const { controller, execAsync } = await setup({ isDesktopBuild: true })

			const caller = t.createCallerFactory(controller.createTrpcRouter())(
				createMockTrpcContext({ isLocalClient: () => false })
			)

			await expect(caller.applyRules()).rejects.toThrow(/machine running Companion/)
			expect(execAsync).not.toHaveBeenCalledWith(expect.stringContaining('pkexec'))
		})
	})

	describe('triggerRegenerate', () => {
		it('writes both rules files and runs the sync command when set', async () => {
			const { controller, generatedDir, execAsync } = await setup({ syncCommand: 'my-sync-command' })

			controller.triggerRegenerate()

			await vi.waitFor(async () => {
				expect(await fs.pathExists(path.join(generatedDir, HEADLESS_FILENAME))).toBe(true)
				expect(await fs.pathExists(path.join(generatedDir, DESKTOP_FILENAME))).toBe(true)
			})
			await vi.waitFor(() => {
				expect(execAsync).toHaveBeenCalledWith('my-sync-command')
			})

			// The generated headless file should contain the device rule for the collected usb id
			const written = await fs.readFile(path.join(generatedDir, HEADLESS_FILENAME), 'utf8')
			expect(written).toContain('hidraw')
		})

		it('does nothing on a non-linux platform', async () => {
			const { controller, generatedDir, execAsync } = await setup({
				platform: 'darwin',
				syncCommand: 'my-sync-command',
			})

			controller.triggerRegenerate()
			// Give any (incorrectly scheduled) async work a chance to run
			await new Promise((resolve) => setTimeout(resolve, 80))

			expect(await fs.pathExists(path.join(generatedDir, HEADLESS_FILENAME))).toBe(false)
			expect(execAsync).not.toHaveBeenCalled()
		})
	})
})
