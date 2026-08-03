import QuickLRU from 'quick-lru'
import { useEffect, useRef, useState } from 'react'
import type { TextLayoutCache } from '@companion-app/shared/Graphics/ImageBase.js'
import { GraphicsLayeredButtonRenderer } from '@companion-app/shared/Graphics/LayeredRenderer.js'
import { resolveButtonStyleProperties } from '@companion-app/shared/Graphics/Util.js'
import type { RendererButtonStyle } from '@companion-app/shared/Model/Render.js'
import type { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	ButtonGraphicsShowStatusIcons,
} from '@companion-app/shared/Model/StyleModel.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
// Reuse the same client-side canvas renderer + font loading the button editor preview uses.
import FontLoader from '~/Buttons/EditButton/LayeredButtonEditor/Preview/FontLoader.js'
import { GraphicsImage } from '~/Buttons/EditButton/LayeredButtonEditor/Preview/Image.js'
// `?inline` bundles the logo as a base64 data URL at build time
import companionLogo from './companion-logo.png?inline'

/*
 * Why this preview is rendered client-side from a hardcoded element list, rather than through the
 * normal backend preset preview:
 *  - It must react to the wizard's *unsaved* topbar/status-icon choices. Here we simply run
 *    `resolveButtonStyleProperties` locally with the in-progress values, so the button redraws
 *    instantly with zero backend traffic.
 *  - The animation is a trivial local `setInterval` redraw instead of a stream of backend renders.
 * A future refactor could instead express this as a dedicated internal "preview" preset whose canvas
 * decoration/status-icons are driven by `$(local:...)` values, remounted via the template-preset
 * `variableValues` override flow (see companion/lib/Preview/Graphics.ts) — but the client-side
 * approach keeps this self-contained.
 */

const PAD = 6
const LOGO_DATA_URL: string = companionLogo

/** Build the hardcoded, already-resolved draw elements. `phase` (0..1) drives the animated bar. */
function buildElements(phase: number): SomeButtonGraphicsDrawElement[] {
	// Note: resolved draw elements use opacity in the 0..1 range (not 0..100).
	return [
		{
			type: 'canvas',
			id: 'canvas',
			usage: ButtonGraphicsElementUsage.Automatic,
			contentHash: 'preview-canvas',
			// Follow the global default, which the wizard feeds into resolveButtonStyleProperties below.
			decoration: ButtonGraphicsDecorationType.FollowDefault,
			showStatusIcons: ButtonGraphicsShowStatusIcons.FollowDefault,
		},
		{
			type: 'box',
			id: 'bg',
			usage: ButtonGraphicsElementUsage.Color,
			enabled: true,
			opacity: 1,
			contentHash: 'preview-bg',
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			rotation: 0,
			color: 0x0b2942,
			cornerRadius: 0,
			borderWidth: 0,
			borderColor: 0x000000,
			borderPosition: 'inside',
		},
		{
			type: 'image',
			id: 'logo',
			usage: ButtonGraphicsElementUsage.Image,
			enabled: true,
			opacity: 1,
			contentHash: 'preview-logo',
			x: 0.28,
			y: 0.08,
			width: 0.44,
			height: 0.44,
			rotation: 0,
			base64Image: LOGO_DATA_URL,
			halign: 'center',
			valign: 'top',
			fillMode: 'fit',
		},
		{
			type: 'text',
			id: 'text',
			usage: ButtonGraphicsElementUsage.Text,
			enabled: true,
			opacity: 1,
			contentHash: 'preview-text',
			x: 0,
			y: 0.5,
			width: 1,
			height: 0.32,
			rotation: 0,
			text: 'Companion',
			fontsize: 65,
			fontsizeAllowShrink: true,
			font: 'companion-sans',
			weight: 'normal',
			styles: [],
			color: 0xffffff,
			outlineColor: 0x000000,
			halign: 'center',
			valign: 'center',
		},
		{
			// Animated progress bar along the bottom.
			type: 'box',
			id: 'bar',
			usage: ButtonGraphicsElementUsage.Color,
			enabled: true,
			opacity: 1,
			contentHash: `preview-bar`,
			x: 0.1,
			y: 0.86,
			width: 0.8 * phase,
			height: 0.07,
			rotation: 0,
			color: 0x00b7ff,
			cornerRadius: 100,
			borderWidth: 0,
			borderColor: 0x000000,
			borderPosition: 'inside',
		},
	]
}

interface GraphicsPreviewButtonProps {
	size?: number
	decoration: UserConfigModel['buttons_decoration']
	statusIcons: UserConfigModel['buttons_status_icons']
	/** Draw the button in a pushed state (so the "border when pressed" decoration is visible). */
	pushed?: boolean
	/** The status to show, when status icons are enabled. Defaults to a warning. */
	buttonStatus?: RendererButtonStyle['button_status']
}

/**
 * A single self-contained preview button, drawn client-side and reacting live to the wizard's
 * unsaved decoration/status-icon choices.
 */
export function GraphicsPreviewButton({
	size = 110,
	decoration,
	statusIcons,
	pushed = false,
	buttonStatus = 'warning',
}: GraphicsPreviewButtonProps): React.JSX.Element {
	const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
	const imageRef = useRef<GraphicsImage | null>(null)
	const phaseRef = useRef(0)

	// (Re)create the image whenever the canvas element changes.
	useEffect(() => {
		if (!canvas) return
		const textLayoutCache: TextLayoutCache = new QuickLRU({ maxSize: 200 })
		imageRef.current = GraphicsImage.create(canvas, textLayoutCache)
		return () => {
			imageRef.current = null
		}
	}, [canvas])

	// Draw + animate. Re-runs when the chosen values change; the interval advances the animation.
	useEffect(() => {
		if (!canvas) return

		const draw = () => {
			const image = imageRef.current
			if (!image) return

			try {
				const elements = buildElements(phaseRef.current)

				const drawStyle: RendererButtonStyle = {
					style: 'button-layered',
					drawType: 'button',
					elements,
					pushed,
					stepCurrent: 1,
					stepCount: 1,
					button_status: buttonStatus, // so a status icon is actually drawn when status icons are enabled
					action_running: false,
					...resolveButtonStyleProperties(
						{ buttons_decoration: decoration, buttons_status_icons: statusIcons },
						elements
					),
					location: undefined, // a preview has no real location; the top bar shows an "x/x/x" placeholder
				}

				image.clear()
				GraphicsLayeredButtonRenderer.draw(image, drawStyle, new Set(), null, { x: PAD, y: PAD })
					.then(() => image.drawComplete())
					.catch((e) => {
						console.error('Wizard preview draw failed', e)
					})
			} catch (e) {
				console.error('Wizard preview draw failed', e)
			}
		}

		draw()

		// Redraw once fonts are ready (first paint may happen before the custom fonts load).
		const unsub = FontLoader.listenForFontLoad(() => draw())

		// Animate the progress bar.
		const interval = setInterval(() => {
			phaseRef.current = (phaseRef.current + 0.04) % 1
			draw()
		}, 60)

		return () => {
			clearInterval(interval)
			if (unsub !== 'loaded') unsub()
		}
	}, [canvas, decoration, statusIcons, pushed, buttonStatus])

	return <canvas ref={setCanvas} width={size + PAD * 2} height={size + PAD * 2} style={{ borderRadius: 4 }} />
}
