import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createClient, createConfig } from '@companion-app/shared/OpenApi/ModuleStore/client/index.js'
import { getCompanionModules, getCompanionModuleVersions } from '@companion-app/shared/OpenApi/ModuleStore/index.js'
import { throwTransportErrors } from '../../lib/Resources/OpenApiClient.js'

const jsonResponse = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('OpenApiClient', () => {
	let fetchMock: ReturnType<typeof vi.fn<(req: Request) => Promise<Response>>>

	beforeEach(() => {
		fetchMock = vi.fn(async (_req: Request) => jsonResponse({ modules: [] }))
		vi.stubGlobal('fetch', fetchMock)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	function createTestClient() {
		const client = createClient(
			createConfig({
				baseUrl: 'https://store.example/api',
				headers: { 'User-Agent': 'Companion test' },
			})
		)
		client.interceptors.error.use(throwTransportErrors)
		return client
	}

	test('builds the request from the base url, path and query', async () => {
		const client = createTestClient()

		await getCompanionModules({
			client,
			path: { moduleType: 'connection' },
			query: { 'module-api-version': ['1.0.0', '2.0.0'] },
		})

		expect(fetchMock).toHaveBeenCalledTimes(1)
		const req = fetchMock.mock.calls[0][0]
		expect(req.method).toBe('GET')
		// Arrays are sent as repeated keys, as the module store expects
		expect(req.url).toBe(
			'https://store.example/api/v1/companion/modules/connection?module-api-version=1.0.0&module-api-version=2.0.0'
		)
		expect(req.headers.get('User-Agent')).toBe('Companion test')
	})

	test('encodes path parameters', async () => {
		const client = createTestClient()

		await getCompanionModuleVersions({
			client,
			path: { moduleType: 'surface', moduleName: 'a/b c' },
		})

		expect(fetchMock.mock.calls[0][0].url).toBe('https://store.example/api/v1/companion/modules/surface/a%2Fb%20c')
	})

	test('returns the data of a successful response', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ versions: [] }))
		const client = createTestClient()

		const res = await getCompanionModuleVersions({
			client,
			path: { moduleType: 'connection', moduleName: 'test' },
		})

		expect(res.data).toEqual({ versions: [] })
		expect(res.error).toBeUndefined()
		expect(res.response?.status).toBe(200)
	})

	test('returns an error response without throwing', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Not found' }, 404))
		const client = createTestClient()

		const res = await getCompanionModuleVersions({
			client,
			path: { moduleType: 'connection', moduleName: 'missing' },
		})

		expect(res.data).toBeUndefined()
		expect(res.error).toEqual({ error: 'Not found' })
		expect(res.response?.status).toBe(404)
	})

	test('throws transport errors', async () => {
		const networkError = new TypeError('fetch failed')
		fetchMock.mockRejectedValueOnce(networkError)
		const client = createTestClient()

		await expect(
			getCompanionModuleVersions({
				client,
				path: { moduleType: 'connection', moduleName: 'test' },
			})
		).rejects.toBe(networkError)
	})

	test('throws when the request is aborted', async () => {
		fetchMock.mockImplementationOnce(async (req) => {
			req.signal.throwIfAborted()
			return jsonResponse({ versions: [] })
		})
		const client = createTestClient()

		await expect(
			getCompanionModuleVersions({
				client,
				signal: AbortSignal.abort(),
				path: { moduleType: 'connection', moduleName: 'test' },
			})
		).rejects.toMatchObject({ name: 'AbortError' })
	})
})
