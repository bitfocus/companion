/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { timingSafeEqual } from 'node:crypto'
import Express from 'express'
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client'
import type { ControlsController } from '../Controls/Controller.js'
import type { InstanceController } from '../Instance/Controller.js'
import LogController from '../Log/Controller.js'
import type { PageController } from '../Page/Controller.js'
import type { AppInfo } from '../Registry.js'
import type { ServiceController } from '../Service/Controller.js'
import type { SurfaceController } from '../Surface/Controller.js'
import type { UIExpress } from '../UI/Express.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { DataUserConfig } from './UserConfig.js'

/**
 * One sample of a labeled metric: the label values and the current reading for that combination.
 */
export interface LabeledValue {
	labels: Record<string, string>
	value: number
}

/**
 * The registration surface that subsystems use to define their own metrics inline, next to the data
 * they measure. Implemented by DataMetrics. Depending on this interface (rather than the concrete
 * class) keeps subsystems decoupled from prom-client and the HTTP endpoint.
 */
export interface MetricsRegistry {
	/**
	 * Register a gauge: a current-state value read live at scrape time. Can go up and down.
	 */
	gauge(name: string, help: string, getValue: () => number): void

	/**
	 * Register a counter sourced from an external monotonically-increasing integer. The value is
	 * read at scrape time and the delta since the previous scrape is added to the counter.
	 */
	counter(name: string, help: string, getValue: () => number): void

	/**
	 * Register a gauge with labels: one series per label combination, all read live at scrape time.
	 */
	labeledGauge(name: string, help: string, labelNames: string[], getValues: () => LabeledValue[]): void

	/**
	 * Register a counter with labels. Each label combination bridges its own monotonically-increasing
	 * source: the per-combination delta since the previous scrape is added to that series.
	 */
	labeledCounter(name: string, help: string, labelNames: string[], getValues: () => LabeledValue[]): void

	/**
	 * Register a histogram and return an `observe(value)` function. Unlike gauges/counters this is
	 * push-based: call the returned function once per observed event (e.g. a render duration in seconds).
	 */
	histogram(name: string, help: string, buckets?: number[]): (value: number) => void
}

/**
 * Hosts a Prometheus-compatible metrics endpoint (`/api/metrics`) for operational observability, and
 * acts as the registry that subsystems register their own metrics against (see MetricsRegistry).
 *
 * Unlike DataUsageStatistics (which pushes an anonymised snapshot home once an hour), this is a
 * pull-based local endpoint: metrics read live values at scrape time via `collect()` callbacks, so
 * there are no background timers. Process memory (rss/heap/external/arrayBuffers), GC and event-loop
 * lag come from prom-client's default collectors - passively, without forcing GC.
 */
export class DataMetrics implements MetricsRegistry {
	readonly #logger = LogController.createLogger('Data/Metrics')

	readonly #userConfigController: DataUserConfig
	readonly #register = new Registry()

	constructor(appInfo: AppInfo, userConfigController: DataUserConfig, uiExpress: UIExpress) {
		this.#userConfigController = userConfigController

		// Passive process metrics: rss, heap, external, arrayBuffers, GC duration, event-loop lag, handles
		collectDefaultMetrics({ register: this.#register })

		// System info: an "info" metric - constant value 1, with the facts carried as labels.
		new Gauge({
			name: 'companion_build_info',
			help: 'Companion build information (constant 1, see labels)',
			labelNames: ['version', 'build', 'node_version'],
			registers: [this.#register],
		}).set({ version: appInfo.appVersion, build: appInfo.appBuild, node_version: process.version }, 1)

		uiExpress.metricsRouter = this.#createRouter()
	}

	gauge(name: string, help: string, getValue: () => number): void {
		new Gauge({
			name,
			help,
			registers: [this.#register],
			collect() {
				this.set(getValue())
			},
		})
	}

	counter(name: string, help: string, getValue: () => number): void {
		let lastValue = 0
		new Counter({
			name,
			help,
			registers: [this.#register],
			collect() {
				const value = getValue()
				this.inc(value - lastValue)
				lastValue = value
			},
		})
	}

	labeledGauge(name: string, help: string, labelNames: string[], getValues: () => LabeledValue[]): void {
		new Gauge({
			name,
			help,
			labelNames,
			registers: [this.#register],
			collect() {
				// Reset first so series for things that no longer exist (e.g. a deleted connection) drop out
				// rather than lingering at their last value.
				this.reset()
				for (const { labels, value } of getValues()) {
					this.set(labels, value)
				}
			},
		})
	}

	labeledCounter(name: string, help: string, labelNames: string[], getValues: () => LabeledValue[]): void {
		// Track the last value and labels per label combination so each series bridges its own monotonic
		// source, and so retired combinations can be removed on a later scrape.
		const lastValues = new Map<string, number>()
		const lastLabels = new Map<string, Record<string, string>>()
		new Counter({
			name,
			help,
			labelNames,
			registers: [this.#register],
			collect() {
				const seen = new Set<string>()
				for (const { labels, value } of getValues()) {
					const key = JSON.stringify(labels)
					seen.add(key)
					const lastValue = lastValues.get(key) ?? 0
					this.inc(labels, value - lastValue)
					lastValues.set(key, value)
					lastLabels.set(key, labels)
				}
				// Drop series for combinations that no longer exist (e.g. a removed connection) rather than
				// leaving them in the output forever. Also release their bridge state so the maps don't grow
				// for the lifetime of the process.
				for (const key of lastValues.keys()) {
					if (seen.has(key)) continue
					const labels = lastLabels.get(key)
					if (labels) this.remove(...labelNames.map((labelName) => labels[labelName]))
					lastValues.delete(key)
					lastLabels.delete(key)
				}
			},
		})
	}

	histogram(name: string, help: string, buckets?: number[]): (value: number) => void {
		const histogram = new Histogram({
			name,
			help,
			registers: [this.#register],
			...(buckets ? { buckets } : {}),
		})
		return (value: number) => histogram.observe(value)
	}

	#createRouter(): Express.Router {
		const router = Express.Router()

		router.get('/', (req, res) => {
			// Endpoint is opt-in
			if (!this.#userConfigController.getKey('prometheus_enabled')) {
				res.status(404).send('Not found')
				return
			}

			// Require a bearer token. The token is auto-generated when the feature is enabled, so it should
			// never be empty here, but refuse rather than expose metrics if it somehow is.
			const expectedToken: string = this.#userConfigController.getKey('prometheus_token')
			if (!expectedToken || !this.#isAuthorized(req, expectedToken)) {
				res.set('WWW-Authenticate', 'Bearer')
				res.status(401).send('Unauthorized')
				return
			}

			this.#register
				.metrics()
				.then((metrics) => {
					res.set('Content-Type', this.#register.contentType)
					res.send(metrics)
				})
				.catch((e) => {
					this.#logger.error('Failed to collect metrics', e)
					res.status(500).send('Failed to collect metrics')
				})
		})

		return router
	}

	#isAuthorized(req: Express.Request, expectedToken: string): boolean {
		const header = req.headers.authorization
		if (!header) return false

		const match = /^Bearer\s+(.+)$/i.exec(header)
		if (!match) return false

		const provided = Buffer.from(match[1])
		const expected = Buffer.from(expectedToken)
		// Constant-time compare to avoid leaking the token via timing. Length mismatch is an early reject.
		return provided.length === expected.length && timingSafeEqual(provided, expected)
	}
}

/**
 * Register the high-level, cross-cutting operational counts. These are trivial one-liners pulling
 * from controllers, so they are kept here as a single catalog rather than spread across each
 * controller. Subsystems with richer instrumentation (e.g. graphics) register their own metrics
 * inline via the MetricsRegistry they are given.
 */
export function registerCoreMetrics(
	metrics: MetricsRegistry,
	deps: {
		instance: InstanceController
		surfaces: SurfaceController
		page: PageController
		controls: ControlsController
		variables: VariablesController
		services: ServiceController
	}
): void {
	metrics.labeledGauge(
		'companion_surfaces_connected',
		'Number of connected surfaces by location (total = sum without(location))',
		['location'],
		() => {
			let local = 0
			let remote = 0
			for (const group of deps.surfaces.getDevicesList()) {
				if (!group.surfaces) continue
				for (const surface of group.surfaces) {
					if (!surface.id || !surface.isConnected) continue
					// A surface with a network location (satellite, networked Stream Decks, Studio over IP, etc.)
					// is remote; USB panels and the emulator have no location and are local.
					if (surface.location) remote++
					else local++
				}
			}
			return [
				{ labels: { location: 'local' }, value: local },
				{ labels: { location: 'remote' }, value: remote },
			]
		}
	)
	metrics.gauge('companion_surface_groups', 'Number of user-created surface groups', () => {
		return deps.surfaces.getGroupCount()
	})
	metrics.gauge('companion_satellites_connected', 'Number of connected satellite clients (tcp + websocket)', () => {
		return deps.services.satelliteTcp.clientCount + deps.services.satelliteWebsocket.clientCount
	})
	metrics.gauge('companion_pages', 'Number of pages', () => deps.page.store.getPageCount())
	metrics.gauge('companion_buttons', 'Number of configured buttons', () => deps.controls.getAllButtons().length)
	metrics.gauge('companion_triggers', 'Number of configured triggers', () => deps.controls.getAllTriggers().length)
	metrics.gauge('companion_expression_variables', 'Number of expression variables', () => {
		return deps.controls.getAllExpressionVariables().length
	})
	metrics.gauge('companion_custom_variables', 'Number of custom variables', () => {
		return Object.keys(deps.variables.custom.getDefinitions()).length
	})
}
