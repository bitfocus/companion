import LogController from '../Log/Controller.js'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import type { DataDatabase } from '../Data/Database.js'
import type { ModuleStoreCacheStore, ModuleStoreCacheVersionEntry } from '@companion-app/shared/Model/ModulesStore.js'

const ModuleStoreRoom = 'module-store-cache'

const SUBSCRIBE_REFRESH_INTERVAL = 1000 * 60 * 60 * 6 // Update when a user subscribes to the data, if older than 6 hours

export class ModuleStoreService {
	readonly #logger = LogController.createLogger('Instance/ModuleStoreService')

	/**
	 */
	readonly #db: DataDatabase

	/**
	 * The core interface client
	 */
	readonly #io: UIHandler

	/**
	 */
	#store: ModuleStoreCacheStore

	constructor(io: UIHandler, db: DataDatabase) {
		this.#io = io
		this.#db = db

		this.#store = db.getKey('module-store-cache', {
			lastUpdated: 0,
			modules: {},
		} satisfies ModuleStoreCacheStore)

		// If this is the first time we're running, refresh the store data now
		if (this.#store.lastUpdated === 0) {
			setImmediate(() => this.refreshStoreData())
		}
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('modules-store:refresh', async () => {
			this.refreshStoreData()
		})

		client.onPromise('modules-store:subscribe', async () => {
			client.join(ModuleStoreRoom)

			// Check if the data is stale enough to refresh
			if (this.#store.lastUpdated < Date.now() - SUBSCRIBE_REFRESH_INTERVAL) {
				this.refreshStoreData()
			}

			return this.#store
		})

		client.onPromise('modules-store:unsubscribe', async () => {
			client.leave(ModuleStoreRoom)
		})
	}

	getModuleVersionInfo(moduleId: string, versionId: string): ModuleStoreCacheVersionEntry | null {
		const module = this.#store.modules[moduleId]
		if (!module) return null

		return module.versions.find((v) => v.id === versionId) ?? null
	}

	#isRefreshingStoreData = false
	async refreshStoreData(): Promise<void> {
		if (this.#isRefreshingStoreData) return
		this.#isRefreshingStoreData = true

		try {
			this.#io.emit('modules-store:progress', 0)

			// Simulate a delay
			await new Promise((resolve) => setTimeout(resolve, 1000))
			this.#io.emit('modules-store:progress', 0.2)
			await new Promise((resolve) => setTimeout(resolve, 2000))
			this.#io.emit('modules-store:progress', 0.6)
			await new Promise((resolve) => setTimeout(resolve, 4000))

			// TODO - fetch and transform this from the api once it exists
			this.#store = {
				lastUpdated: Date.now(),
				modules: {
					'bmd-atem': {
						id: 'bmd-atem',
						name: 'Blackmagic: ATEM',
						manufacturer: 'Blackmagic Design',
						products: ['ATEM'],
						keywords: ['blackmagic', 'atem', 'switcher'],
						versions: [
							{
								id: '5.4.3',
								isPrerelease: false,
								releasedAt: new Date('2021-01-01').getTime(),
								tarUrl: 'https://builds.julusian.dev/companion-builds/pkg%20(2).tgz',
							},
							{
								id: '3.14.0',
								isPrerelease: false,
								releasedAt: new Date('2021-01-02').getTime(),
								tarUrl: '',
							},
							{
								id: '3.14.1',
								isPrerelease: false,
								releasedAt: new Date('2021-01-02').getTime(),
								tarUrl: 'https://builds.julusian.dev/companion-builds/atem-test-3.14.1.tgz',
							},
						],
					},
				},
			}

			for (let i = 0; i < 20; i++) {
				this.#store.modules[`test-module-${i}`] = {
					id: `test-module-${i}`,
					name: `Test Module ${i}`,
					manufacturer: 'Test Manufacturer',
					products: ['Test Product'],
					keywords: ['test', 'module'],
					versions: [
						{
							id: '1.0.0',
							isPrerelease: false,
							releasedAt: new Date('2021-01-01').getTime(),
							tarUrl: 'https://builds.julusian.dev/companion-builds/pkg%20(2).tgz',
						},
					],
				}
			}

			this.#db.setKey('module-store-cache', this.#store)

			this.#io.emitToRoom(ModuleStoreRoom, 'modules-store:data', this.#store)
			this.#io.emit('modules-store:progress', 1)
		} catch (e) {
			// TODO - what to do in this situation?
			// This could be on an always offline system
		} finally {
			this.#isRefreshingStoreData = false
		}
	}
}
