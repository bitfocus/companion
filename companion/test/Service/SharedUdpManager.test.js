import { jest } from '@jest/globals'
import EventEmitter from 'events'
import { mock } from 'jest-mock-extended'
import { isTypedArray } from 'util/types'

const mockCreateSocket = jest.fn(() => {
	throw new Error('Not implemented')
})

jest.unstable_mockModule('dgram', () => ({
	Socket: null, // Only needed for types
	createSocket: mockCreateSocket,
}))

const dgram = await import('dgram')
const { ServiceSharedUdpManager } = await import('../../lib/Service/SharedUdpManager')

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
}

// dgram.createSocket = jest.fn(() => {
// 	throw new Error('Not implemented')
// })

function sleepImmediate() {
	return new Promise((resolve) => setImmediate(resolve))
}

class MockSocket extends EventEmitter {
	// TODO
	bind = jest.fn((port, cb) => {
		if (cb) setImmediate(() => cb())
	})

	send = jest.fn()
	close = jest.fn()
}

describe('SharedUdpManager', () => {
	const defaultOwnerId = 'my-owner'

	beforeEach(() => {
		mockCreateSocket.mockClear()
	})

	describe('join', () => {
		test('create socket ok', async () => {
			const service = new ServiceSharedUdpManager()
			expect(service.countActivePorts()).toBe(0)

			const messageFn = jest.fn()
			const errorFn = jest.fn()

			const mockSocket = new MockSocket()
			mockCreateSocket.mockImplementationOnce(() => mockSocket)

			// Make the call
			const id = await service.joinPort('udp4', 1234, defaultOwnerId, messageFn, errorFn)
			expect(id).toBeTruthy()

			expect(messageFn).toHaveBeenCalledTimes(0)
			expect(errorFn).toHaveBeenCalledTimes(0)

			// Socket should have been created
			expect(mockCreateSocket).toHaveBeenCalledTimes(1)
			expect(mockCreateSocket).toHaveBeenCalledWith('udp4', expect.any(Function))

			// Socket should be bound
			expect(mockSocket.bind).toHaveBeenCalledTimes(1)
			expect(mockSocket.bind).toHaveBeenCalledWith(1234, expect.any(Function))

			expect(service.countActivePorts()).toBe(1)
		})

		test('bind throws error', async () => {
			const service = new ServiceSharedUdpManager()
			expect(service.countActivePorts()).toBe(0)

			const messageFn = jest.fn()
			const errorFn = jest.fn()

			const mockSocket = new MockSocket()
			mockCreateSocket.mockImplementationOnce(() => mockSocket)

			mockSocket.bind.mockImplementation(() => {
				throw new Error('Bind Error')
			})

			// Make the call
			await expect(service.joinPort('udp4', 1234, defaultOwnerId, messageFn, errorFn)).rejects.toThrow(/Bind Error/)

			expect(messageFn).toHaveBeenCalledTimes(0)
			expect(errorFn).toHaveBeenCalledTimes(0)

			// Socket should have been created
			expect(mockCreateSocket).toHaveBeenCalledTimes(1)
			expect(mockCreateSocket).toHaveBeenCalledWith('udp4', expect.any(Function))

			// Socket should be bound
			expect(mockSocket.bind).toHaveBeenCalledTimes(1)
			expect(mockSocket.bind).toHaveBeenCalledWith(1234, expect.any(Function))

			// Should still be an active port
			expect(service.countActivePorts()).toBe(1)

			// Clear the port by emitting the error
			mockSocket.emit('error', new Error('Bind Error'))
			expect(service.countActivePorts()).toBe(0)
		})

		test('bind emit error', async () => {
			const service = new ServiceSharedUdpManager()
			expect(service.countActivePorts()).toBe(0)

			const messageFn = jest.fn()
			const errorFn = jest.fn()

			const mockSocket = new MockSocket()
			mockCreateSocket.mockImplementationOnce(() => mockSocket)

			mockSocket.bind.mockImplementation(() => {
				setImmediate(() => {
					// Emit an erorr instead
					mockSocket.emit('error', new Error('Bind Error'))
				})
			})

			// Make the call
			await expect(service.joinPort('udp4', 1234, defaultOwnerId, messageFn, errorFn)).rejects.toThrow(/Bind Error/)

			expect(messageFn).toHaveBeenCalledTimes(0)
			expect(errorFn).toHaveBeenCalledTimes(1)

			// Socket should have been created
			expect(mockCreateSocket).toHaveBeenCalledTimes(1)
			expect(mockCreateSocket).toHaveBeenCalledWith('udp4', expect.any(Function))

			// Socket should be bound
			expect(mockSocket.bind).toHaveBeenCalledTimes(1)
			expect(mockSocket.bind).toHaveBeenCalledWith(1234, expect.any(Function))

			expect(service.countActivePorts()).toBe(0)
		})

		test('second join', async () => {
			const service = new ServiceSharedUdpManager()
			expect(service.countActivePorts()).toBe(0)

			const messageFn = jest.fn()
			const errorFn = jest.fn()

			const mockSocket = new MockSocket()
			mockCreateSocket.mockImplementationOnce(() => mockSocket)

			// Make the call
			const id = await service.joinPort('udp4', 1234, defaultOwnerId, messageFn, errorFn)
			expect(id).toBeTruthy()

			const id2 = await service.joinPort('udp4', 1234, defaultOwnerId, messageFn, errorFn)
			expect(id2).toBeTruthy()

			expect(messageFn).toHaveBeenCalledTimes(0)
			expect(errorFn).toHaveBeenCalledTimes(0)

			// Only called once
			expect(mockCreateSocket).toHaveBeenCalledTimes(1)
			expect(mockSocket.bind).toHaveBeenCalledTimes(1)

			expect(service.countActivePorts()).toBe(1)
		})
	})

	async function setupPort() {
		const service = new ServiceSharedUdpManager()
		expect(service.countActivePorts()).toBe(0)

		const mockSocket = new MockSocket()
		mockCreateSocket.mockImplementationOnce((family, cb) => {
			if (cb) mockSocket.on('message', cb)
			return mockSocket
		})

		// Setup a socket
		const handleId = await service.joinPort('udp4', 1234, defaultOwnerId, jest.fn(), jest.fn())
		expect(handleId).toBeTruthy()
		expect(mockCreateSocket).toHaveBeenCalledTimes(1)
		expect(mockSocket.bind).toHaveBeenCalledTimes(1)
		expect(service.countActivePorts()).toBe(1)

		return {
			service,
			mockSocket,
			handleId,
		}
	}

	describe('sendOnPort', () => {
		test('send ok', async () => {
			const { service, mockSocket, handleId } = await setupPort()

			// Make the call
			const message = Buffer.from('testing message 5')
			service.sendOnPort(defaultOwnerId, handleId, '1.2.3.4', 5678, message)

			expect(mockSocket.send).toHaveBeenCalledTimes(1)
			expect(mockSocket.send).toHaveBeenCalledWith(message, 5678, '1.2.3.4')
		})

		test('send bad ownerId', async () => {
			const { service, mockSocket, handleId } = await setupPort()

			// Make the call
			const message = Buffer.from('testing message 5')
			expect(() => service.sendOnPort('missing owner', handleId, '1.2.3.4', 5678, message)).toThrow(/Not a member/)

			expect(mockSocket.send).toHaveBeenCalledTimes(0)
		})

		test('send bad handleId', async () => {
			const { service, mockSocket, handleId } = await setupPort()

			// Make the call
			const message = Buffer.from('testing message 5')
			expect(() => service.sendOnPort(defaultOwnerId, 'fake handle', '1.2.3.4', 5678, message)).toThrow(/Not a member/)

			expect(mockSocket.send).toHaveBeenCalledTimes(0)
		})

		test('multiple handles can send', async () => {
			const { service, mockSocket, handleId } = await setupPort()

			const handleId2 = await service.joinPort('udp4', 1234, defaultOwnerId, jest.fn(), jest.fn())
			expect(handleId2).toBeTruthy()

			// Make the call
			const message = Buffer.from('testing message 5')
			service.sendOnPort(defaultOwnerId, handleId, '1.2.3.4', 5678, message)
			service.sendOnPort(defaultOwnerId, handleId2, '1.2.3.4', 5678, message)

			expect(mockSocket.send).toHaveBeenCalledTimes(2)
		})
	})

	describe('callbacks', () => {
		async function join(service) {
			const messageFn = jest.fn()
			const errorFn = jest.fn()

			const handleId = await service.joinPort('udp4', 1234, defaultOwnerId, messageFn, errorFn)
			expect(handleId).toBeTruthy()

			expect(messageFn).toHaveBeenCalledTimes(0)
			expect(errorFn).toHaveBeenCalledTimes(0)

			return {
				handleId,
				messageFn,
				errorFn,
			}
		}

		test('message', async () => {
			const { service, mockSocket } = await setupPort()

			const joined1 = await join(service)
			const joined2 = await join(service)

			// Emit a message
			const message = Buffer.from('my secret message')
			const rinfo = { address: 'something' }
			mockSocket.emit('message', message, rinfo)

			// check was called
			expect(joined1.messageFn).toHaveBeenCalledTimes(1)
			expect(joined2.messageFn).toHaveBeenCalledTimes(1)
			expect(joined1.messageFn).toHaveBeenCalledWith(message, rinfo)
			expect(joined2.messageFn).toHaveBeenCalledWith(message, rinfo)
			expect(joined1.errorFn).toHaveBeenCalledTimes(0)
			expect(joined2.errorFn).toHaveBeenCalledTimes(0)
		})

		test('error', async () => {
			const { service, mockSocket } = await setupPort()

			const joined1 = await join(service)
			const joined2 = await join(service)

			// Emit a message
			const error = 'my fake error'
			mockSocket.emit('error', error)

			// check was called
			expect(joined1.errorFn).toHaveBeenCalledTimes(1)
			expect(joined2.errorFn).toHaveBeenCalledTimes(1)
			expect(joined1.errorFn).toHaveBeenCalledWith(error)
			expect(joined2.errorFn).toHaveBeenCalledWith(error)
			expect(joined1.messageFn).toHaveBeenCalledTimes(0)
			expect(joined2.messageFn).toHaveBeenCalledTimes(0)
		})
	})

	describe('leavePort', () => {
		it('leave joined', async () => {
			const { service, handleId } = await setupPort()
			expect(service.countActivePorts()).toBe(1)

			service.leavePort(defaultOwnerId, handleId)

			expect(service.countActivePorts()).toBe(0)
		})

		it('leave without join', async () => {
			const { service } = await setupPort()
			expect(service.countActivePorts()).toBe(1)

			service.leavePort(defaultOwnerId, 'fake-handle')

			expect(service.countActivePorts()).toBe(1)
		})

		it('leave without join 2', async () => {
			const { service, handleId } = await setupPort()
			expect(service.countActivePorts()).toBe(1)

			service.leavePort('fake-owner', handleId)

			expect(service.countActivePorts()).toBe(1)
		})

		it('second join with leaves', async () => {
			const { service, handleId } = await setupPort()
			expect(service.countActivePorts()).toBe(1)

			const handleId2 = await service.joinPort('udp4', 1234, defaultOwnerId, jest.fn(), jest.fn())
			expect(handleId2).toBeTruthy()

			// Leave one
			service.leavePort(defaultOwnerId, handleId)
			expect(service.countActivePorts()).toBe(1)

			// Last leave
			service.leavePort(defaultOwnerId, handleId2)
			expect(service.countActivePorts()).toBe(0)
		})
	})

	describe('leaveAllFromOwner', () => {
		it('leave joined', async () => {
			const { service } = await setupPort()
			expect(service.countActivePorts()).toBe(1)

			service.leaveAllFromOwner(defaultOwnerId)

			expect(service.countActivePorts()).toBe(0)
		})

		it('leave without join', async () => {
			const { service } = await setupPort()
			expect(service.countActivePorts()).toBe(1)

			service.leaveAllFromOwner('fake-owner')

			expect(service.countActivePorts()).toBe(1)
		})

		it('second join with leaves', async () => {
			const { service } = await setupPort()
			expect(service.countActivePorts()).toBe(1)

			const handleId2 = await service.joinPort('udp4', 1234, defaultOwnerId, jest.fn(), jest.fn())
			expect(handleId2).toBeTruthy()

			// Leave both
			service.leaveAllFromOwner(defaultOwnerId)
			expect(service.countActivePorts()).toBe(0)
		})

		it('second join with leaves', async () => {
			const { service } = await setupPort()
			expect(service.countActivePorts()).toBe(1)

			const secondOwner = 'second-owner'

			const handleId2 = await service.joinPort('udp4', 1234, secondOwner, jest.fn(), jest.fn())
			expect(handleId2).toBeTruthy()

			// Leave first
			service.leaveAllFromOwner(defaultOwnerId)
			expect(service.countActivePorts()).toBe(1)

			// Leave second
			service.leaveAllFromOwner(secondOwner)
			expect(service.countActivePorts()).toBe(0)
		})
	})
})
