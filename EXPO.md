# Station Pulse Expo demo

Station Pulse is an offline synthetic-data Expo app with Fleet and Station views. The Station page shows deterministic summaries and expandable troubleshooting checks; it does not call ChatGPT or a connected LLM. Station snapshots are exported from `outputs/PCA_Results.xlsx`; detailed tag guidance is shared with the workbook and Word generator through `troubleshooting-content.js`. The app-data exporter does not open the fault answer key.

## Local browser preview

1. Install project dependencies with `npm install`.
2. Build the web preview with `npm run preview:build`. This regenerates the synthetic workbooks, ten Word references, station data, and the Expo static web export.
3. Host the resulting `dist/` folder using an owner-approved account to create a shareable URL. No public deployment is configured.

For local development, run `npm run expo:web`. Browser source buttons open the selected compressor's `.docx` asset, which the browser may display or download based on browser support and hosting headers.

## iPhone and Expo Go

For the native app, install Expo Go from the iOS App Store, run `npm run expo:start` on a computer, and scan its development QR code with the iPhone Camera app. The phone and computer must be able to reach each other, usually on the same local network; Expo tunnel mode may be used if needed. Native **View source (Word)** invokes the system share/open sheet for the station's Word reference. iOS may preview, share, download, or hand it to Word depending on installed apps and device settings.

## Station behavior and source limits

- The T² chart plots 24 chronological hourly scores against the frozen healthy-calibration threshold. Exceedances are highlighted.
- Synthetic fault cases affect only the final four monitoring records. Their displayed 24-hour windows have 20 below-threshold T² values followed by four exceedances.
- The predefined summary identifies the leading Q residual contributor and latest value/unit, plus a competing contributor. Expand each numbered check to see what it helps distinguish and when to escalate.
- Expanding an exceedance row shows a **View top 3 trends** control. It opens a Targa-themed sheet with one 24-point actual-value line chart per top-three T2 contributor for that selected hour. Each chart uses that measurement unit and its own scale and marks the selected hour; the sheet labels its time window and notes that contributions are not confirmed causes.
- Beneath the chart, each hourly T2 exceedance has a selectable row. Expanding it shows all five measurement contributions for that hour, ranked by absolute magnitude with their actual values, units, signed terms, and absolute-magnitude shares. The signed terms use `z_j * sum_k(p_jk * score_k / eigenvalue_k)` and sum to that hour's T2 score. This is a chosen additive decomposition of the quadratic score, not a root-cause test; negative terms offset the total. Q/SPE residual contributions remain separately labeled because they measure a different quantity.
- `references/COMP-01.docx` through `references/COMP-10.docx` are generated from `troubleshooting-content.js`. Each document contains stable section IDs, revision, detailed checks, escalation notes, and linked source URLs. The source button opens the document for the selected compressor.
- The cited manufacturer manuals are generic reference examples. The installed transmitter, meter, driver, and speed pickup models are unknown, so users must confirm equipment applicability. No site limits, setpoints, alarm values, calibration intervals, or equipment-specific adjustments are invented.
- OSHA process-safety requirements, NIST calibration context, and manufacturer manuals do not replace controlled site procedures. These are demonstration documents, not approved PSM guidance. Contributor rankings guide investigation and do not establish root cause; COMP-06's weaker attribution remains documented.

## Targa Resources visual theme

The palette and typefaces are based on the official Targa Resources site at <https://www.targaresources.com/>. Its published styles use the dark navy `#02315B`, blue `#1D5296`, slate `#1A2F41`, orange `#FB7629`, gold `#FFBC00`, and lime `#82BC00`, and include Source Sans Pro and Raleway. Those two font families are bundled locally for native and web use. Alert and normal states also use text labels and chart symbols so meaning does not depend on color alone.

## References used

- Emerson, Rosemount 3051 Pressure Transmitter Reference Manual: <https://www.emerson.com/is/content/emerson/en/measurement-instrumentation/technical/products/pressure/documents/dl-rmt-3051-pressure-transmitter-76002.pdf>
- Emerson, Rosemount 5300 Level Transmitter Manual: <https://www.emerson.com/is/content/emerson/en/measurement-instrumentation/technical/products/level/documents/doc-rosemount-00809-0100-4530.pdf>
- Emerson, Micro Motion 1700 and 2700 Transmitters Manual: <https://www.emerson.com/is/content/emerson/en/measurement-instrumentation/technical/products/flow-coriolis/documents/dl-rmt-1700-2700-62378.pdf>
- OSHA, Process Safety Management, 29 CFR 1910.119: <https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.119>
- NIST Calibration Services: <https://www.nist.gov/calibrations>

The project does not identify the installed compressor, driver/governor, or RPM pickup model. RPM checks therefore refer generically to approved controller indications, independent speed measurement where available, and the exact installed equipment manual. Do not approach running equipment or change control/protection settings for troubleshooting.

No physical iPhone Safari or Expo Go runtime test has been performed. Expo export verifies bundling only. A public preview URL requires hosting and publication outside this workspace.
