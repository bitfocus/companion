#!/bin/bash
#
# Companion desktop installer for Linux.
#
# Copies this Companion build to a proper install location (system-wide or
# per-user), registers it in the application menu with an icon, and checks for
# the system libraries it needs.
#
# Usage:
#   ./install.sh             interactive (prompts for scope)
#   ./install.sh --system    install to /opt (needs root)
#   ./install.sh --user      install to ~/.local/share
#   ./install.sh --force     overwrite an existing install without prompting

set -euo pipefail

APP_ID="companion"

# Where this script (and the rest of the build) lives.
SOURCE_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"

SCOPE=""
FORCE=0

usage() {
	cat <<EOF
Companion installer

Usage: $0 [options]

Options:
  --system    Install system-wide to /opt/companion (requires root)
  --user      Install for the current user to ~/.local/share/companion
  --force     Overwrite an existing install without asking
  -h, --help  Show this help

With no scope option the installer asks where to install.
EOF
}

for arg in "$@"; do
	case "$arg" in
	--system) SCOPE="system" ;;
	--user) SCOPE="user" ;;
	--force) FORCE=1 ;;
	-h | --help)
		usage
		exit 0
		;;
	*)
		echo "Unknown option: $arg" >&2
		usage >&2
		exit 1
		;;
	esac
done

# Sanity check: make sure we're being run from inside a Companion build.
if [ ! -x "$SOURCE_DIR/companion-launcher" ]; then
	echo "Error: companion-launcher was not found next to this script." >&2
	echo "Run install.sh from inside the extracted Companion folder." >&2
	exit 1
fi

# Pick a scope. If none was given on the command line, ask - but only if we
# have a real terminal to read from.
if [ -z "$SCOPE" ]; then
	if [ ! -t 0 ]; then
		echo "Error: no scope given and not running interactively." >&2
		echo "Pass --system or --user when piping the installer." >&2
		exit 1
	fi

	echo "Where should Companion be installed?"
	echo "  1) System-wide (/opt/companion, needs administrator password)"
	echo "  2) Just for me (~/.local/share/companion, no password)"
	while true; do
		read -r -p "Choose [1/2]: " choice
		case "$choice" in
		1)
			SCOPE="system"
			break
			;;
		2)
			SCOPE="user"
			break
			;;
		*) echo "Please enter 1 or 2." ;;
		esac
	done
fi

# For a system install we need root. Re-exec under sudo if we aren't already.
if [ "$SCOPE" = "system" ] && [ "${EUID:-$(id -u)}" -ne 0 ]; then
	if ! command -v sudo >/dev/null 2>&1; then
		echo "Error: a system-wide install needs root, but sudo is not available." >&2
		echo "Re-run this script as root." >&2
		exit 1
	fi
	echo "A system-wide install needs administrator rights; re-running with sudo..."
	exec sudo -- "$(readlink -f "${BASH_SOURCE[0]}")" --system $([ "$FORCE" -eq 1 ] && echo --force)
fi

# Resolve all the destination paths for the chosen scope.
if [ "$SCOPE" = "system" ]; then
	INSTALL_DIR="/opt/$APP_ID"
	APPLICATIONS_DIR="/usr/local/share/applications"
	HICOLOR_DIR="/usr/local/share/icons/hicolor"
else
	DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
	INSTALL_DIR="$DATA_HOME/$APP_ID"
	APPLICATIONS_DIR="$DATA_HOME/applications"
	HICOLOR_DIR="$DATA_HOME/icons/hicolor"
fi
ICON_DIR="$HICOLOR_DIR/256x256/apps"
DESKTOP_FILE="$APPLICATIONS_DIR/$APP_ID.desktop"

# Don't let the install target be the folder we're running from.
if [ "$SOURCE_DIR" = "$INSTALL_DIR" ]; then
	echo "Error: Companion is already located at the install target ($INSTALL_DIR)." >&2
	echo "Run the installer from a freshly extracted download instead." >&2
	exit 1
fi

# Handle an existing install: confirm, then remove for a clean replace.
if [ -e "$INSTALL_DIR" ]; then
	if [ "$FORCE" -ne 1 ]; then
		if [ ! -t 0 ]; then
			echo "Error: $INSTALL_DIR already exists. Pass --force to overwrite." >&2
			exit 1
		fi
		read -r -p "$INSTALL_DIR already exists. Replace it? [y/N]: " reply
		case "$reply" in
		[yY] | [yY][eE][sS]) ;;
		*)
			echo "Aborted."
			exit 1
			;;
		esac
	fi
	echo "Removing existing install at $INSTALL_DIR..."
	rm -rf "$INSTALL_DIR"
fi

# Copy the build into place. cp -a preserves the executable bits and is
# filesystem-agnostic, so this works from read-only mounts and across devices.
echo "Installing Companion to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
cp -a "$SOURCE_DIR/." "$INSTALL_DIR/"

# Electron's SUID sandbox helper must be owned by root and setuid for a
# system-wide install. (User installs fall back to the namespace sandbox.)
if [ "$SCOPE" = "system" ] && [ -e "$INSTALL_DIR/chrome-sandbox" ]; then
	chown root:root "$INSTALL_DIR/chrome-sandbox"
	chmod 4755 "$INSTALL_DIR/chrome-sandbox"
fi

# Install the application icon into the hicolor theme.
echo "Installing icon..."
mkdir -p "$ICON_DIR"
cp "$SOURCE_DIR/icon.png" "$ICON_DIR/$APP_ID.png"

# Generate the .desktop file from the template, pointing at the install dir.
echo "Registering application menu entry..."
mkdir -p "$APPLICATIONS_DIR"
sed -e "s|@EXEC_PATH@|$INSTALL_DIR/companion-launcher|g" \
	-e "s|@ICON_NAME@|$APP_ID|g" \
	"$SOURCE_DIR/$APP_ID.desktop.in" >"$DESKTOP_FILE"

if command -v desktop-file-validate >/dev/null 2>&1; then
	desktop-file-validate "$DESKTOP_FILE" || echo "Warning: .desktop validation reported issues (continuing)."
fi

# Best-effort check for the system libraries Companion needs.
check_dependencies() {
	local pkgs="libusb-1.0-0 libudev1 libfontconfig1"
	if ! command -v dpkg >/dev/null 2>&1; then
		echo "Note: Companion needs these system libraries to be present:"
		echo "      libusb-1.0-0, libudev, libfontconfig1"
		echo "      Install them with your distribution's package manager if missing."
		return
	fi

	local missing=""
	local pkg
	for pkg in $pkgs; do
		if ! dpkg -s "$pkg" >/dev/null 2>&1; then
			missing="$missing $pkg"
		fi
	done
	missing="${missing# }"

	if [ -z "$missing" ]; then
		return
	fi

	echo "The following required packages appear to be missing:$missing"
	if ! command -v apt-get >/dev/null 2>&1; then
		echo "Install them with: sudo apt-get install -y $missing"
		return
	fi
	if [ ! -t 0 ]; then
		echo "Install them with: sudo apt-get install -y $missing"
		return
	fi

	read -r -p "Install them now with apt-get? [y/N]: " reply
	case "$reply" in
	[yY] | [yY][eE][sS])
		if [ "${EUID:-$(id -u)}" -eq 0 ]; then
			apt-get install -y $missing
		else
			sudo apt-get install -y $missing
		fi
		;;
	*)
		echo "Skipped. Install them later with: sudo apt-get install -y $missing"
		;;
	esac
}
check_dependencies

# Refresh the desktop and icon caches so the entry shows up promptly.
if command -v update-desktop-database >/dev/null 2>&1; then
	update-desktop-database "$APPLICATIONS_DIR" 2>/dev/null || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
	gtk-update-icon-cache -f -t "$HICOLOR_DIR" 2>/dev/null || true
fi

# Offer to clean up the folder we were run from.
if [ -t 0 ]; then
	read -r -p "Delete the original extracted folder ($SOURCE_DIR)? [y/N]: " reply
	case "$reply" in
	[yY] | [yY][eE][sS])
		# Step out of the directory before removing it.
		cd /
		rm -rf "$SOURCE_DIR"
		echo "Removed $SOURCE_DIR."
		;;
	*) ;;
	esac
fi

echo
echo "Companion is installed at $INSTALL_DIR"
echo "It should now appear in your application menu."
echo "You can also launch it directly with: $INSTALL_DIR/companion-launcher"
echo
echo "If launching fails with a GTK 2/3 vs GTK 4 error, append: --gtk-version=3"
echo "For headless/server use, see $INSTALL_DIR/README and companion_headless.sh"
