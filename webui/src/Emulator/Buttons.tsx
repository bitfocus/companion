import React, { useMemo } from 'react'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { ButtonPreview } from '~/Components/ButtonPreview.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { observer } from 'mobx-react-lite'
import { useButtonPressHandler, useKeyboardListener } from './PressMutations.js'
import type { GetCachedImage } from './ImageCache.js'

interface EmulatorButtonsProps {
	emulatorId: string
	getImage: GetCachedImage
	columns: number
	rows: number
	enableExtendedKeymap: boolean
}

export const EmulatorButtons = observer(function EmulatorButtons({
	emulatorId,
	getImage,
	columns,
	rows,
	enableExtendedKeymap,
}: EmulatorButtonsProps) {
	const buttonClick = useButtonPressHandler(emulatorId)

	useKeyboardListener(emulatorId, enableExtendedKeymap)

	const gridStyle = useMemo(() => {
		return {
			gridTemplateColumns: 'minmax(0, 1fr) '.repeat(columns),
			gridTemplateRows: 'minmax(0, 1fr) '.repeat(rows),
			aspectRatio: `${columns} / ${rows}`,
			height: `min(calc(100vw / ${columns} * ${rows}), 100vh)`,
			width: `min(calc(100vh / ${rows} * ${columns}), 100vw)`,
		}
	}, [rows, columns])

	const buttonElms = []
	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < columns; x++) {
			buttonElms.push(
				<ButtonPreview2 key={`${y}/${x}`} column={x} row={y} preview={getImage(x, y)} onClick={buttonClick} />
			)
		}
	}

	return (
		<MyErrorBoundary>
			<div className="emulatorgrid">
				<div className="buttongrid" style={gridStyle}>
					{buttonElms}
				</div>
			</div>
		</MyErrorBoundary>
	)
})

interface ButtonPreview2Props {
	column: number
	row: number

	preview: string | undefined | null | false
	onClick: (location: ControlLocation, pressed: boolean) => void
}
function ButtonPreview2({ column, row, ...props }: ButtonPreview2Props) {
	const location = useMemo(() => ({ pageNumber: 0, column, row }), [column, row])
	return <ButtonPreview {...props} location={location} title={`Button ${column}/${row}`} />
}
