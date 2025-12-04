import type { SurfaceSchemaPixelFormat } from '@companion-surface/host'

/**
 * We don't use the cards in Companion, they are intended for use by Satellite, to show a card when there is no connection to Companion.
 */
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

		// Return an empty buffer
		return Buffer.alloc(width * height * bpp)
	}
}
