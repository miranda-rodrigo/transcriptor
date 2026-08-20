#!/bin/bash
# OpenWhispr install helper (fallback installer).
#
# Normal install: drag OpenWhispr.app onto the Applications shortcut in this
# window. Use this script only if that fails (app already running, stale
# permissions, no admin rights, Finder errors like -60008).
#
# What it does:
#   1. Quits any running copy of OpenWhispr
#   2. Copies OpenWhispr.app to /Applications (or ~/Applications without admin)
#   3. Removes the Gatekeeper quarantine flag
#   4. Clears stale Accessibility/Microphone permission entries
#   5. Opens the freshly installed app
#
# It CANNOT grant permissions for you — macOS only allows that through
# System Settings. The app will guide you through those prompts on first use.

set -u

APP_NAME="OpenWhispr.app"
BUNDLE_ID="com.herotools.openwispr"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

say_step() { printf '\n==> %s\n' "$1"; }

# Locate the .app sitting next to this script (on the DMG) or in Downloads.
SRC=""
for candidate in "$SCRIPT_DIR/$APP_NAME" "$HOME/Downloads/$APP_NAME" "$HOME/Desktop/$APP_NAME"; do
  if [ -d "$candidate" ]; then
    SRC="$candidate"
    break
  fi
done

if [ -z "$SRC" ]; then
  echo "Could not find $APP_NAME next to this script, in Downloads, or on the Desktop."
  echo "Open the OpenWhispr DMG and run this script from inside it."
  read -r -p "Press Enter to close..." _
  exit 1
fi

say_step "Found $SRC"

# 1. Quit any running copy (moving a running app is what causes Finder -60008).
say_step "Quitting any running OpenWhispr..."
osascript -e 'tell application "OpenWhispr" to quit' >/dev/null 2>&1 || true
sleep 1
pkill -x "OpenWhispr" >/dev/null 2>&1 || true
sleep 1

# 2. Pick the destination: /Applications when writable, otherwise ~/Applications.
DEST_DIR="/Applications"
if [ ! -w "$DEST_DIR" ]; then
  DEST_DIR="$HOME/Applications"
  mkdir -p "$DEST_DIR"
  echo "No admin rights for /Applications — installing to $DEST_DIR instead."
fi
DEST="$DEST_DIR/$APP_NAME"

say_step "Installing to $DEST..."
rm -rf "$DEST"
if ! cp -R "$SRC" "$DEST"; then
  echo "Copy failed. Close any program using OpenWhispr and run this script again."
  read -r -p "Press Enter to close..." _
  exit 1
fi

# 3. Remove the quarantine flag so Gatekeeper does not warn on an unsigned build.
say_step "Removing quarantine flag..."
xattr -rd com.apple.quarantine "$DEST" >/dev/null 2>&1 || true

# 4. Clear stale permission entries from previous installs/builds.
#    (Harmless if there were none; the app re-requests on first use.)
say_step "Clearing stale permission entries..."
tccutil reset Accessibility "$BUNDLE_ID" >/dev/null 2>&1 || true
tccutil reset Microphone "$BUNDLE_ID" >/dev/null 2>&1 || true

# 5. Launch the installed copy.
say_step "Opening OpenWhispr..."
open "$DEST"

echo ""
echo "Done! OpenWhispr lives in the menu bar (top-right of your screen)."
echo "It will ask for Microphone and Accessibility permissions on first use."
read -r -p "Press Enter to close..." _
