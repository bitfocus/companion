import { LoopbackNetwork, LoopbackTransport } from './helpers/LoopbackTransport.js'
import { describeLinkTransportContract } from './helpers/TransportContract.js'
import { createTransportTestContext } from './helpers/TransportTestContext.js'

// The end to end tests rely on the loopback transport behaving like a real one
describeLinkTransportContract(
	'loopback',
	async () => {
		const network = new LoopbackNetwork()
		const endpoint = (name: string) => {
			const ctx = createTransportTestContext(name)
			return { ctx, transport: new LoopbackTransport(ctx.context, network) }
		}
		const a = endpoint('a')
		const b = endpoint('b')

		return {
			a,
			b,
			dropB: async () => network.drop(b.transport),
			reconnect: async () => {
				network.goDown()
				network.goUp()
			},
			destroy: async () => {
				await a.transport.destroy()
				await b.transport.destroy()
			},
		}
	},
	{ timeout: 10_000 }
)
