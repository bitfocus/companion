import './SurfaceControlDetail.css'
import { memo } from 'react'
import type { SurfaceControlKind } from '@companion-app/shared/SurfaceLayout.js'

interface SurfaceControlDetailProps {
	kind: SurfaceControlKind
}

/**
 * What marks a control out as more than a key: the pointer of a knob, the dimple of a jog wheel, the grip of a
 * shuttle ring. Drawn over whatever the control shows, so a knob still reads as one with an image on it.
 */
export const SurfaceControlDetail = memo(function SurfaceControlDetail({ kind }: SurfaceControlDetailProps) {
	// A key, or a slice of a screen, is just its outline
	if (kind === 'button' || kind === 'lcd-segment') return null

	return <div className={`surface-control-detail surface-control-detail-${kind}`} aria-hidden />
})
