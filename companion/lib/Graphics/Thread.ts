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

import v8 from 'node:v8'
import vm from 'node:vm'
import { threadId } from 'node:worker_threads'
import workerPool from 'workerpool'
import { GraphicsThreadMethods } from './ThreadMethods.js'

workerPool.worker(GraphicsThreadMethods)

// Diagnostics / stopgap: render workers allocate native (Skia/@napi-rs/canvas) memory per render that
// is NOT reported to V8, so with a tiny stable JS heap the worker almost never GCs — and the finalizers
// that free that native memory never run, so process `rss` climbs while every V8 metric stays flat.
//
// Force a GC here and log rss before/after. If `reclaimed` is large, the native memory IS collectable
// and this loop doubles as a stopgap; the real fix is to stop allocating native objects per render
// (reuse) or report their size to V8 so its own GC keeps up.
v8.setFlagsFromString('--expose-gc')
const forceGc = vm.runInNewContext('gc') as (() => void) | undefined

const memTimer = setInterval(() => {
	const mb = (b: number) => Math.round(b / 1024 / 1024)
	const before = process.memoryUsage()
	forceGc?.()
	const after = process.memoryUsage()
	// eslint-disable-next-line no-console
	console.log(
		`[render-worker ${threadId}] rss ${mb(before.rss)}->${mb(after.rss)}MB (reclaimed ${mb(before.rss - after.rss)}MB) ` +
			`heapUsed=${mb(after.heapUsed)}MB external=${mb(after.external)}MB arrayBuffers=${mb(after.arrayBuffers)}MB`
	)
}, 30_000)
memTimer.unref()
