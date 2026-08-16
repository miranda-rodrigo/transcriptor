# OpenWhispr on managed Macs

The shipping install is a **signed, notarized DMG**. Users (or MDM) drag `OpenWhispr.app` into `/Applications`. Do not run the app from the mounted disk image — that binds microphone/accessibility grants to a temporary path and breaks paste + updates.

OpenWhispr needs macOS privacy permissions that MDM (Jamf, Kandji, Mosyle, Intune) often locks down:

| Permission | Why | TCC service |
|---|---|---|
| Microphone | Record dictation | `ListenEvent` is not used; this is `Microphone` |
| Accessibility | Simulate ⌘V to paste into the frontmost app | `Accessibility` |
| Apple Events | Talk to System Events to perform that paste | `AppleEvents` → `com.apple.systemevents` |

The bundle ID is `com.herotools.openwispr` (historical spelling — do not “fix” the missing **h**, or existing TCC grants break). Team ID: `9R85XFMH59`.

## Deploy the PPPC profile

1. Review [`OpenWhispr-PPPC.mobileconfig`](./OpenWhispr-PPPC.mobileconfig).
2. Sign it with your MDM/organization certificate if your fleet requires signed profiles.
3. Push it to the Macs that will run OpenWhispr **before** first launch when possible.
4. Deploy the notarized DMG (or the `.app` extracted from it) to `/Applications` as the admin/MDM user. Standard users should not be asked to approve Accessibility.

After the profile is installed, a standard user can finish onboarding (microphone prompt still appears unless you also pre-approve Microphone in the same profile).

## Auto-update on locked `/Applications`

If the `.app` is owned by root (normal MDM install), the in-app updater cannot replace the bundle. OpenWhispr detects this and shows a message instead of a generic failure.

Options for IT:

- Ship the new DMG through MDM (recommended).
- Allow the OpenWhispr group to write `/Applications/OpenWhispr.app` if you want in-app updates.
- Let users install a personal copy under `~/Applications` from the same DMG.

## Network

Model downloads use Hugging Face (`huggingface.co`). Auto-update uses GitHub Releases (`github.com` / `objects.githubusercontent.com`). Allow those hosts, or pre-seed `~/.cache/openwhispr/whisper-models` and disable cloud features.

## Do not change the bundle ID

`com.herotools.openwispr` is the shipping identifier. Changing it resets TCC, Accessibility, and Apple Events for every existing install.
