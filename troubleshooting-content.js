const tags = [
  {
    key: 'Throughput_MMSCFD', name: 'Throughput', unit: 'MMSCFD', code: 'THR',
    summary: 'Check whether the flow change is corroborated by the process and an independent indication before treating it as a process change.',
    steps: [
      { action: 'Confirm the timestamp, engineering units, meter status/quality, and whether the value is instantaneous flow or a totalized/rate value. Review recent maintenance or configuration changes.', distinguishes: 'A stale, invalid, mis-scaled, or differently defined signal from an actual flow change.', escalate: 'If status is bad, units are uncertain, or a configuration change is unexplained, involve instrumentation/control staff before using the value for decisions.' },
      { action: 'Compare the indication with an independent flow measurement or flow-computer value, if available, and with the operating log. Compare related suction/discharge pressure, speed, and load trends at the same timestamps.', distinguishes: 'A change affecting the process from a single-tag measurement or data-path issue; correlated trends help locate where the process change may begin.', escalate: 'Escalate a sustained mismatch or a flow change associated with equipment alarms or protective events under the site procedure.' },
      { action: 'Ask the control-room operator to verify the approved lineup and operating demand from the control system. Do not operate valves or open a meter body as a diagnostic step.', distinguishes: 'A documented operating transition from an unexplained measurement shift.', escalate: 'Use the site change-management and permit/isolation processes for any field inspection or adjustment; engineering/instrumentation review is appropriate if the cause remains unclear.' }
    ],
    sources: ['OSHA_PSM', 'NIST_CAL']
  },
  {
    key: 'Suction_Pressure_psig', name: 'Suction pressure', unit: 'psig', code: 'SUC',
    summary: 'Corroborate suction pressure against the upstream header and another indication; distinguish a supply/process change from an instrument-path issue.',
    steps: [
      { action: 'Check transmitter health/status, timestamp, range, units, and recent calibration/configuration or maintenance history. Compare with a second indication or approved local gauge when available.', distinguishes: 'An invalid, shifted, or incorrectly ranged signal from a real pressure change.', escalate: 'Request instrumentation review if indications disagree, status is abnormal, or the range/configuration cannot be confirmed.' },
      { action: 'Trend suction pressure against the upstream supply/header and the neighboring equipment, plus throughput, speed, and discharge pressure. Check existing alarm/event history.', distinguishes: 'An upstream supply or common-header change from a local compressor or measurement issue.', escalate: 'Follow the approved low-suction, surge, and protective-action procedures if their site-defined alarms/events occur; do not wait for this diagnostic sequence.' },
      { action: 'Have authorized personnel review the pressure connection/impulse path and any associated isolation or manifold status using the equipment manual and site permit/isolation rules. Do not loosen a pressurized fitting.', distinguishes: 'A blocked, leaking, or isolated measurement connection from a process pressure change.', escalate: 'Any inspection requiring process contact, opening a fitting, or electrical work requires the applicable site authorization and isolation.' }
    ],
    sources: ['ROSEMOUNT_3051', 'OSHA_PSM', 'NIST_CAL']
  },
  {
    key: 'Discharge_Pressure_psig', name: 'Discharge pressure', unit: 'psig', code: 'DIS',
    summary: 'Compare discharge and downstream pressure trends before deciding whether backpressure or the measurement channel is the stronger lead.',
    steps: [
      { action: 'Verify tag identity, timestamp, units, transmitter status/range, and recent maintenance or configuration history. Compare with an independent indication if available.', distinguishes: 'A data-quality, configuration, or instrument problem from a process pressure change.', escalate: 'Ask instrumentation/control staff to investigate if readings conflict, the status is abnormal, or the calibration/configuration is uncertain.' },
      { action: 'Compare discharge pressure with downstream header pressure, related unit indications, suction pressure, temperature, throughput, speed, and existing alarms/events.', distinguishes: 'A downstream restriction/backpressure pattern or operating transition from a localized transmitter anomaly; correlated measurements provide context, not proof.', escalate: 'Follow site-defined high-pressure, temperature, vibration, or protective-event procedures immediately when applicable.' },
      { action: 'Ask the control-room operator to verify approved valve lineup and control response from existing indications and logs. Do not move a valve, alter a setpoint, or change protection logic to test a hypothesis.', distinguishes: 'A documented lineup/control change from an unexplained pressure trend.', escalate: 'Route suspected restriction, control malfunction, or repeated abnormal pressure to operations and engineering under site procedures; field checks require applicable permits/isolation.' }
    ],
    sources: ['ROSEMOUNT_3051', 'OSHA_PSM', 'NIST_CAL']
  },
  {
    key: 'RPM', name: 'RPM', unit: 'rpm', code: 'RPM',
    summary: 'Compare the displayed speed with controller demand and an independent speed indication, where safely available; do not approach rotating equipment.',
    steps: [
      { action: 'Check the speed tag timestamp, quality/status, units, controller demand, driver status, and event/alarm history. Compare with an independent approved speed indication if one is available.', distinguishes: 'A speed pickup/transmission or display problem from a real change in shaft speed or control demand.', escalate: 'Escalate disagreement, bad quality, overspeed/underspeed alarm, trip, or abnormal vibration immediately through the site response procedure.' },
      { action: 'Have authorized controls/instrument personnel review the pickup diagnostics, signal path, and recent maintenance/configuration history against the exact installed driver and sensor manuals.', distinguishes: 'A sensor, wiring, configuration, or controller signal issue from a driver/load/control issue.', escalate: 'Do not inspect wiring or sensor installation near operating machinery; electrical and mechanical work requires site authorization and isolation as applicable.' },
      { action: 'Compare speed with load, throughput, and pressure trends and ask operations to confirm the intended operating mode from records.', distinguishes: 'A process/load transition from an isolated speed indication or control anomaly.', escalate: 'Do not adjust governor, speed demand, overspeed trip, or protective settings as troubleshooting. Refer unexplained changes to operations and the responsible engineering/maintenance group.' }
    ],
    sources: ['OSHA_PSM', 'NIST_CAL']
  },
  {
    key: 'Slug_Catcher_Level_pct', name: 'Slug catcher level', unit: '%', code: 'SCL',
    summary: 'Check level indication quality and corroborate accumulation with an independent indication and process context; use site high-level response procedures for alarms.',
    steps: [
      { action: 'Confirm timestamp, percent scale/range, level transmitter status, and recent calibration/configuration or maintenance history. Compare with an independent local indication where installed and safe to read.', distinguishes: 'A scaling, stale-signal, or instrument problem from a real level change.', escalate: 'If the indications disagree or instrument status is abnormal, request instrumentation review; do not enter or open process equipment to verify level.' },
      { action: 'Trend level with upstream liquid/process conditions, inflow/outflow indicators, and existing alarm/event history. Review control-system indication of the level controller and dump-valve feedback without changing commands.', distinguishes: 'Accumulation or changing liquid handling from a sensor/feedback problem; feedback is not proof of actual valve movement.', escalate: 'At site-defined high/high-high alarms, suspected carryover, or protective events, follow the approved response immediately and notify operations.' },
      { action: 'Ask authorized operations/maintenance personnel to verify the approved liquid-handling lineup and instrument installation history. Do not manually drain, bypass, or force a valve based on this anomaly summary.', distinguishes: 'A documented operating change from unexplained level behavior.', escalate: 'Any field action must follow approved procedures, permits, isolation, and environmental controls; escalate suspected carryover or loss of containment without delay.' }
    ],
    sources: ['ROSEMOUNT_5300', 'OSHA_PSM', 'NIST_CAL']
  }
];

const references = {
  ROSEMOUNT_3051: { title: 'Rosemount 3051 Pressure Transmitter Reference Manual', publisher: 'Emerson', url: 'https://www.emerson.com/is/content/emerson/en/measurement-instrumentation/technical/products/pressure/documents/dl-rmt-3051-pressure-transmitter-76002.pdf', note: 'Manufacturer reference example for pressure transmitter installation, configuration, diagnostics, and maintenance. Match the manual to the installed model/revision.' },
  ROSEMOUNT_5300: { title: 'Rosemount 5300 Level Transmitter Manual', publisher: 'Emerson', url: 'https://www.emerson.com/is/content/emerson/en/measurement-instrumentation/technical/products/level/documents/doc-rosemount-00809-0100-4530.pdf', note: 'Manufacturer reference example for guided-wave radar level measurement. Confirm the installed transmitter and probe configuration before applying.' },
  MICRO_MOTION_2700: { title: 'Micro Motion 1700 and 2700 Transmitters Manual', publisher: 'Emerson', url: 'https://www.emerson.com/is/content/emerson/en/measurement-instrumentation/technical/products/flow-coriolis/documents/dl-rmt-1700-2700-62378.pdf', note: 'Manufacturer reference example for transmitter configuration and diagnostics. The project does not identify the installed flow meter or speed pickup model; verify equipment applicability.' },
  OSHA_PSM: { title: 'OSHA Process Safety Management of Highly Hazardous Chemicals, 29 CFR 1910.119', publisher: 'U.S. Occupational Safety and Health Administration', url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.119', note: 'Regulatory framework for covered processes, including operating procedures, training, mechanical integrity, and management of change; not equipment-specific troubleshooting steps.' },
  NIST_CAL: { title: 'NIST Calibration Services', publisher: 'National Institute of Standards and Technology', url: 'https://www.nist.gov/calibrations', note: 'Metrology and calibration context. It does not establish site-specific calibration intervals or tolerances.' }
};

const revision = '1.0 | synthetic demonstration | 2026-11-16';
const compressors = Array.from({ length: 10 }, (_, i) => `COMP-${String(i + 1).padStart(2, '0')}`);
module.exports = { tags, references, revision, compressors };
