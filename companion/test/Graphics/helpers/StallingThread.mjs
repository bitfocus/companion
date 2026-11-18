import workerPool from 'workerpool'

workerPool.worker({
	stall: () => {
		for (;;) {
			// Never returns, like a renderer which has locked up
		}
	},
	add: (a, b) => a + b,
})
