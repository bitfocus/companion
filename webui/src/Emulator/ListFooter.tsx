export function EmulatorListFooter(): React.JSX.Element {
	return (
		<footer className="emulator-list-footer">
			<details>
				<summary>Keyboard &amp; remote shortcuts</summary>
				<div className="emulator-list-footer-content">
					<div>
						Use <b>1 2 3 4 5 6 7 8</b>, <b>Q W E R T Y U I</b>, <b>A S D F G H J K</b>, <b>Z X C V B N M ,</b> to
						control an emulator with your keyboard.
					</div>
					<div className="mt-2">
						If enabled in the Surface Settings, a Logitech R400/Mastercue/DSan will send a button press to button: 2
						(Back), 3 (forward), 4 (black), and for logitech: 10/11 (Start and stop) on each page.
					</div>
				</div>
			</details>
		</footer>
	)
}
