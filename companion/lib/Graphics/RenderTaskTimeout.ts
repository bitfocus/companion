/*
 * This file is part of the Companion project
 * Copyright (c) 2026 Bitfocus AS
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import workerPool from 'workerpool'
import type { GraphicsThreadMethods } from './ThreadMethods.js'

/**
 * How long each task may run on a render thread before it is taken to have stalled (eg some text locking up the
 * renderer). The thread is then terminated and replaced, so that one stalled task can't stop everything else from
 * being drawn. Generous, as a slow machine can take a while over a large image
 */
export const RENDER_TASK_TIMEOUT_MS: Readonly<Record<keyof typeof GraphicsThreadMethods, number>> = {
	drawButtonImageBuffer: 10_000,
	drawElementRaster: 10_000,
	drawImageBuffers: 10_000,
	createImagePreview: 30_000,
	decodeImage: 30_000,
}

export class RenderTaskStalledError extends Error {
	constructor(method: string, timeoutMs: number) {
		super(`Render task ${method} stalled for more than ${timeoutMs / 1000}s`)
		this.name = 'RenderTaskStalledError'
	}
}

/**
 * Run a task in the pool, rejecting with a RenderTaskStalledError if it runs for longer than the timeout. Time spent
 * waiting for a free thread doesn't count. The thread running it is terminated, and replaced by the pool
 */
export async function execWithStallTimeout<T>(
	pool: ReturnType<typeof workerPool.pool>,
	method: string,
	args: unknown[],
	timeoutMs: number
): Promise<T> {
	return pool
		.exec(method, args)
		.timeout(timeoutMs)
		.catch((e: unknown) => {
			if (e instanceof workerPool.Promise.TimeoutError) throw new RenderTaskStalledError(method, timeoutMs)
			throw e
		})
}

/** Images are left out of the dump of a stalled draw, as they can be megabytes */
const MAX_LOGGED_STRING_LENGTH = 1000

/**
 * Stringify what a stalled draw was drawing, to log it. Long strings (images) and binary data are replaced with their
 * size, so that it stays small enough to log
 */
export function stringifyDrawStyleForLog(drawStyle: unknown): string {
	return JSON.stringify(drawStyle, (_key, value: unknown) => {
		if (typeof value === 'string' && value.length > MAX_LOGGED_STRING_LENGTH) {
			return `<${value.length} chars: ${value.slice(0, 40)}…>`
		}
		if (ArrayBuffer.isView(value)) return `<${value.byteLength} bytes>`
		if (value instanceof Map) return Object.fromEntries(value)
		if (value instanceof Set) return [...value]
		return value
	})
}
