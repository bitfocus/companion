import './SurfaceLeds.css'
import classNames from 'classnames'
import { memo, useMemo } from 'react'
import type { LedGaugeDescription } from '@companion-app/shared/Graphics/GaugeLeds.js'
import type { SurfaceSchemaLedsConfig } from '@companion-app/shared/Model/Surfaces.js'
import { layoutLeds } from './ledLayout.js'

interface SurfaceLedsProps {
	config: SurfaceSchemaLedsConfig
	leds: LedGaugeDescription | null
}

/** The leds of a control - a ring around an encoder, a strip - lit as the surface would light them */
export const SurfaceLeds = memo(function SurfaceLeds({ config, leds }: SurfaceLedsProps) {
	const layout = useMemo(() => layoutLeds(config, leds), [config, leds])

	if (layout.type === 'ring') {
		return (
			<svg className="surface-control-leds surface-control-led-ring" viewBox={layout.viewBox} aria-hidden>
				{/* The dark track the leds sit in, which shows between them and keeps them apart from the face */}
				<circle className="led-track" cx={50} cy={50} r={layout.radius} strokeWidth={layout.width + 2} />
				{layout.segments.map((segment, index) => (
					<path
						key={index}
						d={segment.path}
						strokeWidth={layout.width}
						className={classNames('led', { 'led-off': !segment.color })}
						stroke={segment.color ?? undefined}
					/>
				))}
			</svg>
		)
	}

	return (
		<svg className="surface-control-leds" viewBox={layout.viewBox} preserveAspectRatio="none" aria-hidden>
			{layout.segments.map((segment, index) => (
				<rect
					key={index}
					x={segment.x}
					y={segment.y}
					width={segment.width}
					height={segment.height}
					className={classNames('led', { 'led-off': !segment.color })}
					fill={segment.color ?? undefined}
				/>
			))}
		</svg>
	)
})
