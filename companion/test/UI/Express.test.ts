import Express from 'express'
import supertest from 'supertest'
import { describe, expect, test } from 'vitest'
import { UIExpress } from '../../lib/UI/Express.js'

describe('UIExpress', () => {
	function createApp() {
		return new UIExpress(Express.Router()).app
	}

	test('does not serve the frontend app for unknown backend protocol routes', async () => {
		const app = createApp()

		await expect(supertest(app).get('/socket.io/socket.io.js')).resolves.toMatchObject({ status: 404 })
		await expect(supertest(app).get('/trpc')).resolves.toMatchObject({ status: 404 })
		await expect(supertest(app).get('/api/get_userconfig_all')).resolves.toMatchObject({ status: 404 })
	})
})
