#!/bin/bash
# Install FM26 Display Fix to BETA staging (NOT loaded by BepInEx).
#
# BepInEx only loads plugins from BepInEx/plugins/* — this keeps the DLL
# outside that tree until you opt in manually.
#
#   FM26_GAME="/path/to/Football Manager 26" bash install_displayfix_beta.sh
#
# To test in game, copy or symlink into plugins (remove when done):
#   cp ~/fm26_bep/BETA/FM26DisplayFix/FM26DisplayFix.dll \
#      ~/fm26_bep/plugins/FM26DisplayFix/
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
BEP="${FM26_BEP:-$HOME/fm26_bep}"
SRC="$HERE/BETA/FM26DisplayFix/FM26DisplayFix.dll"
DEST="$BEP/BETA/FM26DisplayFix"

if [ ! -f "$SRC" ]; then
  echo "ERROR: $SRC not found — run build_displayfix.sh first." >&2
  exit 1
fi

mkdir -p "$DEST"
cp "$SRC" "$DEST/FM26DisplayFix.dll"
xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

echo "Installed (BETA, not active): $DEST/FM26DisplayFix.dll"
echo ""
echo "Display Fix is NOT loaded until you copy it into plugins:"
echo "  mkdir -p \"$BEP/plugins/FM26DisplayFix\""
echo "  cp \"$DEST/FM26DisplayFix.dll\" \"$BEP/plugins/FM26DisplayFix/\""
echo ""
echo "To disable again, remove $BEP/plugins/FM26DisplayFix/"
