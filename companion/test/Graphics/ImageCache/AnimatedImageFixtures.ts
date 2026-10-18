import { crc32 } from 'node:zlib'
import { Canvas, GifEncoder } from '@napi-rs/canvas'

export interface FixtureFrame {
	/** The colour filling the frame */
	color: [number, number, number]
	/** How long the frame is shown for, in ms */
	delayMs: number
}

function makeFramePixels(width: number, height: number, color: [number, number, number]): Uint8Array {
	const pixels = new Uint8Array(width * height * 4)
	for (let i = 0; i < pixels.length; i += 4) {
		pixels.set([...color, 255], i)
	}
	return pixels
}

/** Create an animated GIF, with each frame filled with a solid colour */
export function makeAnimatedGif(width: number, height: number, frames: FixtureFrame[]): Buffer {
	const encoder = new GifEncoder(width, height, { repeat: 0 })
	for (const frame of frames) {
		encoder.addFrame(makeFramePixels(width, height, frame.color), width, height, { delay: frame.delayMs })
	}
	return Buffer.from(encoder.finish())
}

interface PngChunk {
	type: string
	data: Buffer
}

function readPngChunks(png: Buffer): PngChunk[] {
	const chunks: PngChunk[] = []
	let offset = 8
	while (offset < png.length) {
		const length = png.readUInt32BE(offset)
		chunks.push({
			type: png.subarray(offset + 4, offset + 8).toString('latin1'),
			data: png.subarray(offset + 8, offset + 8 + length),
		})
		offset += 12 + length
	}
	return chunks
}

function writePngChunk(type: string, data: Buffer): Buffer {
	const header = Buffer.alloc(8)
	header.writeUInt32BE(data.length, 0)
	header.write(type, 4, 'latin1')
	const crc = Buffer.alloc(4)
	crc.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), data])))
	return Buffer.concat([header, data, crc])
}

/** Create an animated PNG, with each frame filled with a solid colour */
export function makeAnimatedPng(width: number, height: number, frames: FixtureFrame[]): Buffer {
	const framePngs = frames.map((frame) => {
		const canvas = new Canvas(width, height)
		const ctx = canvas.getContext('2d')
		ctx.fillStyle = `rgb(${frame.color.join(',')})`
		ctx.fillRect(0, 0, width, height)
		return readPngChunks(canvas.toBuffer('image/png'))
	})

	const output: Buffer[] = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]
	output.push(writePngChunk('IHDR', framePngs[0].find((chunk) => chunk.type === 'IHDR')!.data))

	const animationControl = Buffer.alloc(8)
	animationControl.writeUInt32BE(frames.length, 0) // frame count
	animationControl.writeUInt32BE(0, 4) // loop forever
	output.push(writePngChunk('acTL', animationControl))

	let sequenceNumber = 0
	frames.forEach((frame, index) => {
		const frameControl = Buffer.alloc(26)
		frameControl.writeUInt32BE(sequenceNumber++, 0)
		frameControl.writeUInt32BE(width, 4)
		frameControl.writeUInt32BE(height, 8)
		frameControl.writeUInt32BE(0, 12) // x offset
		frameControl.writeUInt32BE(0, 16) // y offset
		frameControl.writeUInt16BE(frame.delayMs, 20) // delay numerator
		frameControl.writeUInt16BE(1000, 22) // delay denominator
		frameControl.writeUInt8(0, 24) // dispose: none
		frameControl.writeUInt8(0, 25) // blend: source
		output.push(writePngChunk('fcTL', frameControl))

		for (const chunk of framePngs[index].filter((chunk) => chunk.type === 'IDAT')) {
			if (index === 0) {
				output.push(writePngChunk('IDAT', chunk.data))
			} else {
				const sequence = Buffer.alloc(4)
				sequence.writeUInt32BE(sequenceNumber++)
				output.push(writePngChunk('fdAT', Buffer.concat([sequence, chunk.data])))
			}
		}
	})

	output.push(writePngChunk('IEND', Buffer.alloc(0)))
	return Buffer.concat(output)
}

export function toDataUrl(mimeType: string, data: Buffer): string {
	return `data:${mimeType};base64,${data.toString('base64')}`
}
