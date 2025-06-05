/**
 * Copyright 2013 Mathias Buus
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { EventEmitter } from 'events'
import {
	spawn,
	fork,
	exec,
	ChildProcessByStdio,
	SpawnOptionsWithoutStdio,
	ForkOptions,
	Serializable,
	StdioOptions,
} from 'child_process'
import type { Writable, Readable } from 'stream'
import ps from 'ps-tree'

function kill(pid: number, sig?: string): void {
	if (process.platform === 'win32') {
		exec('taskkill /pid ' + pid + ' /T /F')
		return
	}
	ps(pid, (_, psPids) => {
		const pids = (psPids || []).map((item) => {
			return parseInt(item.PID, 10)
		})

		pids.push(pid)

		for (const pid of pids) {
			try {
				process.kill(pid, sig)
			} catch (_err) {
				// do nothing
			}
		}
	})
}

function defaultSleep(sleep: number | number[] | undefined) {
	sleep = Array.isArray(sleep) ? sleep : [sleep || 1000]
	return (restarts: number): number => {
		return sleep[restarts - 1] || sleep[sleep.length - 1]
	}
}

export interface RespawnOptions {
	// name?: string
	cwd?: string
	env?: NodeJS.ProcessEnv
	uid?: number
	gid?: number

	stdio?: StdioOptions
	stdout?: NodeJS.WritableStream
	stderr?: NodeJS.WritableStream

	silent?: boolean
	fork?: boolean
	windowsVerbatimArguments?: boolean

	sleep?: number | number[] | ((restarts: number) => number)
	maxRestarts?: number
	kill?: number | false
}

export interface RespawnEvents {
	'force-kill': []
	spawn: [child: RespawnChild]
	crash: []
	stop: []
	start: []
	sleep: []
	exit: [code: number | null, signal: string | null]

	stdout: [data: Buffer]
	stderr: [data: Buffer]
	message: [data: Serializable]
	warn: [err: Error]
}

export type RespawnStatus = 'stopped' | 'crashed' | 'running' | 'sleeping' | 'stopping'

export type RespawnChild = ChildProcessByStdio<null | Writable, null | Readable, null | Readable>

export class RespawnMonitor extends EventEmitter<RespawnEvents> {
	public id: string | null

	private status: RespawnStatus
	private command: string[] | (() => string[])
	// private name: string | undefined
	private cwd: string | undefined
	private env: NodeJS.ProcessEnv | undefined
	// private data: Record<string, any> | undefined
	private uid: number | undefined
	private gid: number | undefined
	public pid: number | undefined
	private crashes: number
	private stdio: StdioOptions | undefined
	private stdout: NodeJS.WritableStream | undefined
	private stderr: NodeJS.WritableStream | undefined
	private silent: boolean | undefined
	private windowsVerbatimArguments: boolean | undefined
	private spawnFn: (cmd: string, args: string[], opts: ForkOptions | SpawnOptionsWithoutStdio) => RespawnChild

	public crashed: boolean
	private sleep: (restarts: number) => number
	private maxRestarts: number
	private kill: number | false
	private shouldRestart: boolean

	/*private*/ child: RespawnChild | null
	private started: Date | null
	private timeout: NodeJS.Timeout | undefined

	constructor(command: string[] | (() => string[]), opts: RespawnOptions) {
		super()

		this.id = null // for respawn-group

		this.status = 'stopped'
		this.command = command
		// this.name = opts.name
		this.cwd = opts.cwd || '.'
		this.env = opts.env || {}
		// this.data = opts.data || {}
		this.uid = opts.uid
		this.gid = opts.gid
		this.pid = 0
		this.crashes = 0
		this.stdio = opts.stdio
		this.stdout = opts.stdout
		this.stderr = opts.stderr
		this.silent = opts.silent
		this.windowsVerbatimArguments = opts.windowsVerbatimArguments
		this.spawnFn = opts.fork ? fork : spawn

		this.crashed = false
		this.sleep = typeof opts.sleep === 'function' ? opts.sleep : defaultSleep(opts.sleep)
		this.maxRestarts = opts.maxRestarts === 0 ? 0 : opts.maxRestarts || -1
		this.kill = opts.kill === false ? false : opts.kill || 30000
		this.shouldRestart = true

		this.child = null
		this.started = null
		this.timeout = undefined
	}

	stop(cb?: () => void): void {
		if (this.status === 'stopped' || this.status === 'stopping') return cb && cb()
		this.status = 'stopping'

		clearTimeout(this.timeout)

		if (cb) {
			if (this.child) this.child.on('exit', cb)
			else process.nextTick(cb)
		}

		if (!this.child) return this.#stopped()

		if (this.kill !== false) {
			const child = this.child

			const wait = setTimeout(() => {
				if (!child.pid) return

				kill(child.pid, 'SIGKILL')
				this.emit('force-kill')
			}, this.kill)

			this.child.on('exit', () => {
				clearTimeout(wait)
			})
		}

		if (this.child.pid) kill(this.child.pid)
	}

	start(): void {
		if (this.status === 'running') return

		let restarts = 0
		let clock = 60000

		const loop = () => {
			const cmd = typeof this.command === 'function' ? this.command() : this.command
			const child = this.spawnFn(cmd[0], cmd.slice(1), {
				cwd: this.cwd,
				env: { ...process.env, ...(this.env || {}) },
				uid: this.uid,
				gid: this.gid,
				stdio: this.stdio,
				silent: this.silent,
				windowsVerbatimArguments: this.windowsVerbatimArguments,
			})

			this.started = new Date()
			this.status = 'running'
			this.child = child
			this.pid = child.pid
			this.emit('spawn', child)

			child.setMaxListeners(0)

			if (child.stdout) {
				child.stdout.on('data', (data) => {
					this.emit('stdout', data)
				})

				if (this.stdout) {
					child.stdout.pipe(this.stdout)
				}
			}

			if (child.stderr) {
				child.stderr.on('data', (data) => {
					this.emit('stderr', data)
				})

				if (this.stderr) {
					child.stderr.pipe(this.stderr)
				}
			}

			child.on('message', (message) => {
				this.emit('message', message)
			})

			const clear = () => {
				if (this.child !== child) return false
				this.child = null
				this.pid = 0
				return true
			}

			child.on('error', (err) => {
				this.emit('warn', err) // too opionated? maybe just forward err
				if (!clear()) return
				if (this.status === 'stopping') return this.#stopped()
				this.#crashed()
			})

			child.on('exit', (code, signal) => {
				this.emit('exit', code, signal)
				if (!clear()) return
				if (this.status === 'stopping') return this.#stopped()

				clock -= Date.now() - (this.started ? this.started.getTime() : 0)

				if (clock <= 0) {
					clock = 60000
					restarts = 0
				}

				if (++restarts > this.maxRestarts && this.maxRestarts !== -1) return this.#crashed()
				if (!this.shouldRestart) return this.#stopped()

				this.status = 'sleeping'
				this.emit('sleep')

				const restartTimeout = this.sleep(restarts)
				this.timeout = setTimeout(loop, restartTimeout)
			})
		}

		clearTimeout(this.timeout)
		loop()

		// @ts-expect-error this can happen
		if (this.status === 'running') this.emit('start')
	}

	// toJSON(): RespawnJson {
	// 	const doc: RespawnJson = {
	// 		id: this.id,
	// 		name: this.name,
	// 		status: this.status,
	// 		started: this.started??undefined,
	// 		pid: this.pid,
	// 		crashes: this.crashes,
	// 		command: this.command,
	// 		cwd: this.cwd,
	// 		env: this.env,
	// 		data: this.data,
	// 	}

	// 	if (!doc.id) delete doc.id
	// 	if (!doc.pid) delete doc.pid
	// 	if (!doc.name) delete doc.name
	// 	if (!doc.data) delete doc.data
	// 	if (!doc.started) delete doc.started

	// 	return doc
	// }

	#crashed(): void {
		if (this.status !== 'running') return
		this.status = 'crashed'
		this.crashes++
		this.emit('crash')
		if (this.status === 'crashed') this.#stopped()
	}
	#stopped(): void {
		if (this.status === 'stopped') return
		if (this.status !== 'crashed') this.status = 'stopped'
		this.started = null
		this.emit('stop')
	}
}

// export function respawn(command, opts) {
// 	if (typeof command !== 'function' && !Array.isArray(command)) return respawn(command.command, command)
// 	return new RespawnMonitor(command, opts || {})
// }
