/**
 * A guide line drawn across the preview at a snapped position.
 *
 * Positioned as a percentage of the overlay box, like everything else the overlays render: the canvas is
 * resized to fit its container, so a backing-pixel offset would drift away from the position it marks.
 */
export function SnapGuide({
	orientation,
	positionPercent,
}: {
	orientation: 'vertical' | 'horizontal'
	positionPercent: string
}): React.JSX.Element {
	const vertical = orientation === 'vertical'

	const style: React.CSSProperties = {
		// Blue, to stay distinct from the red bounds lines the renderer draws around the selected element
		position: 'absolute',
		background: '#00a3ff',
		pointerEvents: 'none',
		...(vertical
			? { left: positionPercent, top: 0, bottom: 0, width: 1 }
			: { top: positionPercent, left: 0, right: 0, height: 1 }),
	}

	return <div style={style} />
}
