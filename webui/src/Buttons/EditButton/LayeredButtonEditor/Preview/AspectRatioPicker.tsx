import { useSubscription } from '@trpc/tanstack-react-query'
import { PencilIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ClientSurfaceButtonSizesItem } from '@companion-app/shared/Model/Surfaces.js'
import type { DropdownChoice } from '@companion-module/base'
import { InputGroup, InputGroupText } from '~/Components/Form.js'
import { NumberInputField } from '~/Components/NumberInputField.js'
import { Popover } from '~/Components/Popover.js'
import { trpc } from '~/Resources/TRPC.js'
import { parseAspectRatio } from './canvasSize.js'
import { collectSurfaceAspectRatios, type SurfaceAspectRatioChoice } from './surfaceAspectRatios.js'

const ASPECT_RATIO_OPTIONS: DropdownChoice[] = [
	{ id: '1:1', label: '1:1 (Square)' },
	{ id: '9:7', label: '9:7 (Stream Deck Studio)' },
	{ id: '2:1', label: '2:1 (Stream Deck Plus & Plus XL)' },
]

/** The ratios the preset buttons already cover, which the surface list therefore leaves out */
const PRESET_ASPECT_RATIO_IDS: readonly string[] = ASPECT_RATIO_OPTIONS.map((option) => String(option.id))

const CUSTOM_RATIO_MIN = 1
// Large enough for the ratios real surfaces produce, such as the 124:29 of a Stream Deck Neo's info bar
const CUSTOM_RATIO_MAX = 999

/**
 * The control strip under the preview canvas: a button per common ratio, plus a popover for anything else.
 */
export function AspectRatioPicker({
	value,
	setValue,
}: {
	value: string
	setValue: (value: string) => void
}): React.JSX.Element {
	return (
		<div className="button-layer-canvas-footer">
			<span className="button-layer-footer-label">Aspect Ratio</span>
			<div className="button-layer-aspect-options">
				{ASPECT_RATIO_OPTIONS.map((option) => {
					const id = String(option.id)
					return (
						<button
							key={id}
							type="button"
							title={option.label}
							className={`button-layer-aspect-option${value === id ? ' active' : ''}`}
							onClick={() => setValue(id)}
						>
							<AspectRatioGlyph ratio={parseAspectRatio(id)} />
						</button>
					)
				})}
				<CustomAspectRatioButton value={value} setValue={setValue} active={!PRESET_ASPECT_RATIO_IDS.includes(value)} />
			</div>
		</div>
	)
}

/**
 * Lets a ratio be entered by hand, or picked from the surfaces Companion knows about, for surfaces that don't
 * have a preset button. The value is the same "w:h" string the presets use, so it needs no special handling
 * anywhere else.
 */
function CustomAspectRatioButton({
	value,
	setValue,
	active,
}: {
	value: string
	setValue: (value: string) => void
	active: boolean
}) {
	return (
		<Popover.Root>
			<Popover.Trigger
				color={null}
				className={`button-layer-aspect-option${active ? ' active' : ''}`}
				title="Custom aspect ratio"
			>
				<PencilIcon size={14} />
			</Popover.Trigger>
			<Popover.Popup className="button-layer-aspect-custom" align="end">
				<CustomAspectRatioPopoverContent value={value} setValue={setValue} />
			</Popover.Popup>
		</Popover.Root>
	)
}

/**
 * Only mounted while the popover is open, so nothing subscribes until the picker is actually opened.
 */
function CustomAspectRatioPopoverContent({ value, setValue }: { value: string; setValue: (value: string) => void }) {
	const [surfaces, setSurfaces] = useState<ClientSurfaceButtonSizesItem[]>([])

	useSubscription(
		trpc.surfaces.watchSurfaceButtonSizes.subscriptionOptions(undefined, {
			onData: (data) => setSurfaces(Object.values(data)),
			onError: (error) => {
				console.error('Failed to subscribe to surface button sizes:', error)
				setSurfaces([])
			},
		})
	)

	const surfaceChoices = useMemo(() => collectSurfaceAspectRatios(surfaces, PRESET_ASPECT_RATIO_IDS), [surfaces])

	return <CustomAspectRatioBody value={value} setValue={setValue} surfaceChoices={surfaceChoices} />
}

/**
 * The body of the custom ratio popover, split out from the subscription above so it can be rendered in
 * isolation.
 */
export function CustomAspectRatioBody({
	value,
	setValue,
	surfaceChoices,
}: {
	value: string
	setValue: (value: string) => void
	surfaceChoices: SurfaceAspectRatioChoice[]
}): React.JSX.Element {
	// Seeded from whatever is currently applied, preset or not, so opening this is a starting point rather
	// than a jump to some unrelated ratio
	const [w, h] = value.split(':').map(Number)
	const width = isFinite(w) && w > 0 ? w : 4
	const height = isFinite(h) && h > 0 ? h : 3

	const clamp = (val: number) => Math.min(CUSTOM_RATIO_MAX, Math.max(CUSTOM_RATIO_MIN, Math.round(val)))

	return (
		<>
			<InputGroup>
				<InputGroupText>W</InputGroupText>
				<NumberInputField
					id={undefined}
					value={width}
					setValue={(val) => setValue(`${clamp(val)}:${height}`)}
					min={CUSTOM_RATIO_MIN}
					max={CUSTOM_RATIO_MAX}
				/>
			</InputGroup>
			<InputGroup>
				<InputGroupText>H</InputGroupText>
				<NumberInputField
					id={undefined}
					value={height}
					setValue={(val) => setValue(`${width}:${clamp(val)}`)}
					min={CUSTOM_RATIO_MIN}
					max={CUSTOM_RATIO_MAX}
				/>
			</InputGroup>

			{/*
			 * One row per button shape the user's surfaces have, so that connecting a surface is enough for its
			 * shape to be offered here - rather than every surface model having to be listed in the ui. The ratios
			 * already on the preset bar are left out, so this only ever offers something new.
			 *
			 * These are actions rather than a bound selection: what is currently applied is shown by the preset bar
			 * and the fields above, and there is simply nothing to show when no surface has an unusual shape.
			 */}
			{surfaceChoices.length > 0 && (
				<>
					<div className="button-layer-aspect-surfaces-label">From your surfaces</div>
					{surfaceChoices.map((choice) => (
						<Popover.Item
							key={choice.id}
							className={`button-layer-aspect-surface${value === choice.id ? ' active' : ''}`}
							title={choice.label}
							onClick={() => setValue(choice.id)}
						>
							<AspectRatioGlyph ratio={parseAspectRatio(choice.id)} />
							<span className="button-layer-aspect-surface-label">{choice.label}</span>
						</Popover.Item>
					))}
				</>
			)}
		</>
	)
}

// A little outlined rectangle drawn to the ratio, so the option reads at a glance
function AspectRatioGlyph({ ratio }: { ratio: number }) {
	const max = 15
	const glyphWidth = ratio >= 1 ? max : max * ratio
	const glyphHeight = ratio >= 1 ? max / ratio : max
	return <span className="button-layer-aspect-glyph" style={{ width: glyphWidth, height: glyphHeight }} />
}
