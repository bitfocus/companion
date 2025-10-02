import type { SurfaceSchemaPixelFormat } from '@companion-surface/base'

export class CardGenerator {
	async generateBasicCard(
		width: number,
		height: number,
		pixelFormat: SurfaceSchemaPixelFormat,
		_remoteIp: string,
		_status: string
	): Promise<Buffer> {
		return this.generateLogoCard(width, height, pixelFormat)
	}

	async generateLcdStripCard(
		width: number,
		height: number,
		pixelFormat: SurfaceSchemaPixelFormat,
		_remoteIp: string,
		_status: string
	): Promise<Buffer> {
		return this.generateLogoCard(width, height, pixelFormat)
	}

	async generateLogoCard(width: number, height: number, format: SurfaceSchemaPixelFormat): Promise<Buffer> {
		const bpp = format.length

		const fill = bpp === 3 ? Buffer.from([0xff, 0x00, 0x00]) : Buffer.from([0xff, 0x00, 0x00, 0xff])

		return Buffer.alloc(width * height * bpp, fill)
	}
}
