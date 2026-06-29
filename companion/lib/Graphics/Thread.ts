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

import { threadId } from 'node:worker_threads'
import workerPool from 'workerpool'
import { GraphicsThreadMethods } from './ThreadMethods.js'

workerPool.worker(GraphicsThreadMethods)

// Diagnostics: report this render worker's OWN memory. Workers are separate V8 isolates, so their
// heap/external/arrayBuffers never show up in the main process's memory log — only the shared process
// `rss` reflects them. If a worker's external/arrayBuffers climb here, the leak is buffers retained in
// the worker (e.g. accumulating getImageData frames); if the worker's V8 stays flat while process rss
// climbs, it is native (Skia/image-rs) memory no isolate tracks.
const memTimer = setInterval(() => {
	const m = process.memoryUsage()
	const mb = (b: number) => Math.round(b / 1024 / 1024)
	// eslint-disable-next-line no-console
	console.log(
		`[render-worker ${threadId}] rss(proc)=${mb(m.rss)}MB heapUsed=${mb(m.heapUsed)}MB ` +
			`external=${mb(m.external)}MB arrayBuffers=${mb(m.arrayBuffers)}MB`
	)
}, 30_000)
memTimer.unref()
