#!/usr/bin/env bash
# Manual, emulator-only native stress companion for issue #2.
# Open a dirty goal/time editor in Evrida QA before running this script.
# Captures crash logs locally. Never uses the production app ID or deletes data.
set -euo pipefail

command -v adb >/dev/null || { echo "Android platform-tools (adb) are required." >&2; exit 2; }
device="$(adb shell getprop ro.kernel.qemu | tr -d '\r')"
if [[ "$device" != "1" ]]; then
  echo "This script deliberately runs only on an Android emulator." >&2
  exit 2
fi
package="com.nishef.evrida.qa"
adb shell pm path "$package" | grep -q 'package:' || {
  echo "Install the isolated Evrida QA APK first." >&2
  exit 2
}
original_scale="$(adb shell settings get system font_scale | tr -d '\r')"
original_mode="$(adb shell cmd uimode night | tr -d '\r' | sed -n 's/.*Night mode: //p' | head -1)"
restore() {
  if [[ "$original_scale" =~ ^[0-9.]+$ ]]; then
    adb shell settings put system font_scale "$original_scale" >/dev/null 2>&1 || true
  fi
  if [[ "$original_mode" =~ ^(yes|no|auto)$ ]]; then
    adb shell cmd uimode night "$original_mode" >/dev/null 2>&1 || true
  fi
}
trap restore EXIT

directory="${EVRIDA_QA_EVIDENCE_DIR:-.qa-evidence}"
mkdir -p "$directory"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
adb shell am start -n "$package/.MainActivity" >/dev/null
echo "Switch to the QA app and leave an unsaved editor open if you are investigating the dirty-form reproduction."
echo "Beginning live font/theme transitions on the emulator (without wiping the app)."
for scale in 1.0 1.3 1.0 1.5 1.0; do
  adb shell settings put system font_scale "$scale" >/dev/null
  if [[ "$scale" == "1.0" ]]; then adb shell cmd uimode night no >/dev/null
  else adb shell cmd uimode night yes >/dev/null; fi
  sleep 3
  echo "Applied font scale $scale"
done
adb logcat -d -b crash -v threadtime > "$directory/android-crashes-$stamp.log" || true
adb shell dumpsys package "$package" > "$directory/qa-package-$stamp.txt" || true
echo "Native crash-buffer snapshot: $directory/android-crashes-$stamp.log"
if grep -Eiq 'Fatal signal|SIGSEGV|exsqlite3_step|NativeStatement' "$directory/android-crashes-$stamp.log"; then
  echo "Potential crash evidence found. Review timestamps and native stack; do not close P0." >&2
  exit 1
fi
echo "No matching crash in this logcat crash-buffer sample. This is not a proof of Android SQLite stability."
