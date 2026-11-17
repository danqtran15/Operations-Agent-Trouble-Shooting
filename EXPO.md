# Station Pulse Expo demo

Station Pulse is an offline, synthetic-data Expo app with Fleet, Station, and Assistant views. The assistant uses deterministic response templates; it does not call ChatGPT or a connected LLM. Station snapshots are exported from `outputs/PCA_Results.xlsx`. The export reads monitoring scores and measurements only; it does not open the fault answer key.

## Local browser preview

1. Install project dependencies with `npm install`.
2. Refresh the app data after regenerating PCA outputs: `npm run app:data`.
3. Start Expo for web with `npm run expo:web`.
4. Open the local URL printed by Expo. For a boss to open a shareable link, the web build must be hosted by an account or service approved by the project owner. No public deployment or hosting account is configured here.

For a static browser build, run `npx expo export --platform web`; Expo writes the build to `dist/`. Upload that folder to the selected hosting provider to create a shareable URL. Hosting credentials are not stored in this project.

## iPhone Expo Go

Install Expo Go from the iOS App Store on the iPhone. Start `npm run expo:start` on a computer and scan the development QR code with the iPhone Camera app. The phone and computer should be able to reach each other on the same local network; Expo's tunnel option may be used when local network discovery is unavailable. Expo Go testing is distinct from testing the hosted web preview in Safari.

## Response behavior

- A station is normal when its latest T² and Q scores are both at or below their per-compressor thresholds.
- For alerts, the assistant names the top two Q residual contributors, shows their contribution magnitudes, provides a tag-specific initial check, and cites the stable troubleshooting section ID.
- Contributor rankings are diagnostic associations and do not establish root cause. COMP-06's weaker attribution is retained from the validation findings.
- All displayed data and troubleshooting text are synthetic demonstration material, not approved operating instructions.

No actual iPhone or Expo Go test has been performed in this workspace. The developer browser bundle can be built locally; a public share link requires a hosting setup outside the repository.
