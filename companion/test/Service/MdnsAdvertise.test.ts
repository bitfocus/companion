import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import type { DataUserConfig } from '../../lib/Data/UserConfig.js'
import type { LinkController } from '../../lib/Link/Controller.js'
import type { AppInfo } from '../../lib/Registry.js'
import { ServiceMdnsAdvertise } from '../../lib/Service/MdnsAdvertise.js'

// The real Bonjour opens mdns sockets, so record what is published instead
const hoisted = vi.hoisted(() => ({ instances: [] as any[] }))

vi.mock('@julusian/bonjour-service', async () => {
	const { vi } = await import('vitest')
	class Bonjour {
		publish = vi.fn()
		unpublishAll = vi.fn()
		destroy = vi.fn()
		constructor() {
			hoisted.instances.push(this)
		}
	}
	return { Bonjour }
})

function createService(config: Partial<UserConfigModel>) {
	const values: Partial<UserConfigModel> = { mdns_announcements_enabled: true, installName: 'Studio', ...config }
	const userconfig = { getKey: (key: keyof UserConfigModel) => values[key] } as unknown as DataUserConfig
	const link = Object.assign(new EventEmitter(), { id: 'self-link-id' })
	const service = new ServiceMdnsAdvertise(
		userconfig,
		{ machineId: 'machine', appVersion: '5.2.0' } as AppInfo,
		link as unknown as LinkController
	)

	return {
		service,
		link,
		set(key: keyof UserConfigModel, value: any) {
			;(values as any)[key] = value
			service.updateUserConfig(key, value)
		},
		/** The services published by the current Bonjour instance */
		published: () => hoisted.instances.at(-1)?.publish.mock.calls.map(([svc]: any[]) => svc) ?? [],
	}
}

describe('ServiceMdnsAdvertise', () => {
	beforeEach(() => {
		hoisted.instances.length = 0
		vi.useRealTimers()
	})

	it('announces the port accepting direct Link connections, with the Link protocol versions', () => {
		const ctx = createService({ link_direct_enabled: true, link_direct_port: 1234 })

		expect(ctx.published()).toContainEqual(
			expect.objectContaining({
				name: 'Studio',
				type: 'companion-link-ws',
				protocol: 'tcp',
				port: 1234,
				txt: expect.objectContaining({
					version: '5.2.0',
					protocolVersions: expect.any(String),
					linkId: 'self-link-id',
				}),
			})
		)
	})

	it('does not announce direct Link connections while they are switched off', () => {
		const ctx = createService({ link_direct_enabled: false, link_direct_port: 1234 })

		expect(ctx.published().map((svc: any) => svc.type)).toEqual(['companion-satellite-tcp', 'companion-satellite-ws'])
	})

	it('announces again when direct Link connections are switched on, or their port changes', async () => {
		vi.useFakeTimers()
		const ctx = createService({ link_direct_enabled: false, link_direct_port: 1234 })

		ctx.set('link_direct_enabled', true)
		await vi.advanceTimersByTimeAsync(100)
		expect(ctx.published()).toContainEqual(expect.objectContaining({ type: 'companion-link-ws', port: 1234 }))

		ctx.set('link_direct_port', 4321)
		await vi.advanceTimersByTimeAsync(100)
		expect(ctx.published()).toContainEqual(expect.objectContaining({ type: 'companion-link-ws', port: 4321 }))
		expect(hoisted.instances.at(-2).unpublishAll).toHaveBeenCalled()
	})

	it('announces again with the new Link id when it is regenerated', async () => {
		vi.useFakeTimers()
		const ctx = createService({ link_direct_enabled: true, link_direct_port: 1234 })

		ctx.link.id = 'new-link-id'
		ctx.link.emit('self')
		await vi.advanceTimersByTimeAsync(100)
		expect(ctx.published()).toContainEqual(
			expect.objectContaining({ type: 'companion-link-ws', txt: expect.objectContaining({ linkId: 'new-link-id' }) })
		)
	})
})
