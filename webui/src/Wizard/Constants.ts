export const WIZARD_VERSION_2_2 = 22 // 2.2
export const WIZARD_VERSION_3_0 = 30 // 3.0
export const WIZARD_VERSION_3_4 = 34 // 3.4
export const WIZARD_VERSION_4_2 = 42 // 4.2 - adds the usage statistics opt-in step
export const WIZARD_VERSION_4_3 = 43 // 4.3 - rewrites the surfaces step for the surface modules architecture
export const WIZARD_VERSION_5_0 = 50 // 5.0 - adds the timezone step and the button graphics defaults step

// Every wizard version in order, with the label shown in the dev-only "preview from version" control.
// This is the single place to extend when a new version is added: append the new constant here and
// WIZARD_CURRENT_VERSION (and the dev preview list) follow automatically.
export const WIZARD_VERSIONS: { label: string; value: number }[] = [
	{ label: '2.2', value: WIZARD_VERSION_2_2 },
	{ label: '3.0', value: WIZARD_VERSION_3_0 },
	{ label: '3.4', value: WIZARD_VERSION_3_4 },
	{ label: '4.2', value: WIZARD_VERSION_4_2 },
	{ label: '4.3', value: WIZARD_VERSION_4_3 },
	{ label: '5.0', value: WIZARD_VERSION_5_0 },
]

export const WIZARD_CURRENT_VERSION = WIZARD_VERSIONS[WIZARD_VERSIONS.length - 1].value

/** True if `value` is a wizard version that Companion could legitimately have stored. */
export function isKnownWizardVersion(value: unknown): value is number {
	return typeof value === 'number' && WIZARD_VERSIONS.some((v) => v.value === value)
}

/**
 * Decide whether the setup wizard should auto-open based on the stored `setup_wizard` value:
 * - `undefined`: config not loaded yet, do nothing
 * - falsey (`0`/`null`): a fresh install, show the wizard
 * - a known prior version below the current one: an upgrade, show the wizard
 * - anything else (a corrupt/unexpected value): leave it for a manual re-run, don't pester
 */
export function shouldAutoOpenWizard(value: unknown): boolean {
	if (value === undefined) return false
	if (!value) return true
	return isKnownWizardVersion(value) && value < WIZARD_CURRENT_VERSION
}
