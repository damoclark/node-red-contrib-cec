# Local CEC monitor runtime

Based on `@damoclark/cec-monitor@1.0.10-release.5`, published at:
https://registry.npmjs.org/@damoclark/cec-monitor/-/cec-monitor-1.0.10-release.5.tgz

The published JavaScript runtime is retained here so installation cannot replace
the local fixes with an unpatched upstream release. No Babel build is required.
The MIT license below was copied from the published package's README.

Local changes in `lib/cec-monitor.js`:

- Forward `options.comport` as a positional cec-client argument. Trim whitespace,
  normalize Windows COM names, and remove an optional Windows device-path prefix.
- Launch without a shell and with `windowsHide: true` on every start.
- Report spawn errors and stderr through the monitor error event.
- Reconnect after unexpected exit using the same port and configured retry delay.
- Make Stop terminal, cancel retry timers, remove process listeners, and wait for
  the actual child close event. Avoid double close/restart processing.

The protocol tables and message parsing remain upstream code. Dependencies are
declared by the containing Node-RED package; `event-stream` is pinned to 3.3.4.
