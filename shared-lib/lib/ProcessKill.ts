import { exec, spawn } from 'node:child_process'

async function getChildPids(pid: number): Promise<number[]> {
	return new Promise((resolve, reject) => {
		if (process.platform === 'win32') {
			// wmic outputs columns alphabetically regardless of GET order, so ParentProcessId < ProcessId
			const proc = spawn('wmic.exe', ['PROCESS', 'GET', 'ProcessId,ParentProcessId'], {
				signal: AbortSignal.timeout(10000),
			})
			let output = ''
			proc.stdout.on('data', (d) => (output += d))
			let failed = false
			proc.on('error', (err) => {
				failed = true
				reject(err)
			})
			proc.on('close', () => {
				if (failed) return
				const children: number[] = []
				const parents = new Set([pid])
				// Parse the header row to determine column positions
				const lines = output.trim().split('\n')
				if (lines.length < 2) {
					resolve(children)
					return
				}
				const headers = lines[0].trim().split(/\s+/)
				const ppidIdx = headers.indexOf('ParentProcessId')
				const cpidIdx = headers.indexOf('ProcessId')
				if (ppidIdx === -1 || cpidIdx === -1) {
					resolve(children)
					return
				}
				for (const line of lines.slice(1)) {
					const parts = line.trim().split(/\s+/)
					if (parts.length < 2) continue
					const ppid = parseInt(parts[ppidIdx], 10)
					const cpid = parseInt(parts[cpidIdx], 10)
					if (isNaN(ppid) || isNaN(cpid)) continue
					if (parents.has(ppid)) {
						parents.add(cpid)
						children.push(cpid)
					}
				}
				resolve(children)
			})
		} else {
			const proc = spawn('ps', ['-A', '-o', 'ppid=,pid='], {
				signal: AbortSignal.timeout(10000), // Ensure it doesn't hang indefinitely if something goes wrong
			})
			let output = ''
			let failed = false
			proc.stdout.on('data', (d) => (output += d))
			proc.on('error', (err) => {
				failed = true
				reject(err)
			})
			proc.on('close', () => {
				if (failed) return
				const children: number[] = []
				const parents = new Set([pid])
				for (const line of output.trim().split('\n')) {
					const parts = line.trim().split(/\s+/)
					if (parts.length < 2) continue
					const ppid = parseInt(parts[0], 10)
					const cpid = parseInt(parts[1], 10)
					if (isNaN(ppid) || isNaN(cpid)) continue
					if (parents.has(ppid)) {
						parents.add(cpid)
						children.push(cpid)
					}
				}
				resolve(children)
			})
		}
	})
}

export function kill(pid: number, sig = 'SIGTERM'): void {
	if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
		throw new Error('Invalid PID: ' + pid)
	}

	if (process.platform === 'win32') {
		exec(`taskkill /pid ${pid} /T /F`, (err) => {
			if (err) console.warn(`taskkill failed for PID ${pid}:`, err.message)
		})
		return
	}

	getChildPids(pid)
		.then((children) => {
			for (const p of [...children, pid]) {
				try {
					process.kill(p, sig)
				} catch (_) {
					// process already gone
				}
			}
		})
		.catch(() => {
			// If we fail to get child PIDs, at least try to kill the main process
			try {
				process.kill(pid, sig)
			} catch (_) {
				// process already gone
			}

			console.warn(`Failed to get child processes of PID ${pid}, some child processes may not have been killed`)
		})
}
