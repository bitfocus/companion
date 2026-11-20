import { execFileSync } from 'node:child_process'
import workerPool from 'workerpool'

workerPool.worker({
	stall: () => {
		for (;;) {
			// Never returns, like a renderer which has locked up
		}
	},
	// Blocks in native code, where the thread can't be terminated, until it returns
	nativeStall: (ms) => {
		execFileSync(process.execPath, ['-e', `setTimeout(() => {}, ${ms})`])
	},
	add: (a, b) => a + b,
})
