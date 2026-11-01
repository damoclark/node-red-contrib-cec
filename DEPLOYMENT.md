# Windows deployment: version 1.0.4

This guide installs version 1.0.4 from the lizaoreo/node-red-contrib-cec fork.
It includes the patched wrapper. npm installs its JavaScript dependencies normally;
an internet connection or a populated npm cache is required. Keep the
archive to reinstall it; installing the registry version can replace these fixes.

## Before installing on the computer with the adapters

1. Export your Node-RED flows and back up the actual Node-RED user directory,
   including settings, flow credentials, package.json, and package-lock.json.
   Find the user directory in Node-RED's startup log. It is often
   `C:\Users\YOURNAME\.node-red`, but services may use a different account/directory.
2. Stop Node-RED using its normal launcher or service manager. Close any remaining
   cec-client windows from the old installation and any other application using
   these adapters.
3. Copy `node-red-contrib-cec-1.0.4.tgz` to that computer, for example to Downloads.

## Install

Run PowerShell as the account that owns this Node-RED installation. Substitute the
actual user directory and archive path if different:

```powershell
Set-Location "$env:USERPROFILE\.node-red"
npm install --omit=dev "$env:USERPROFILE\Downloads\node-red-contrib-cec-1.0.4.tgz"
npm ls node-red-contrib-cec
```

The reported version should be `1.0.4`. Install in the Node-RED user directory,
not globally and not inside the existing module directory. Restart Node-RED fully
after installation; clicking Deploy alone does not reload installed module code.

Keep the existing Pulse-Eight/libCEC installation. `cec-client.exe` must still be
on the PATH seen by the Node-RED process. A common Windows executable directory is
`C:\Program Files (x86)\Pulse-Eight\USB-CEC Adapter\x64`.
The patch does not change PATH or install drivers/libCEC.

The runtime needs Node.js 8.8 or later for the hidden-window spawn option; use a
Node.js version supported by your installed Node-RED. Regression tests require
Node.js 18 or later and were run with Node.js 22.23.2.

## Configure two adapters

Create two separate CEC adapter configuration entries:

| Setting | Adapter A | Adapter B |
| --- | --- | --- |
| CEC Com Port | COM3 | COM4 |
| OSD Name | node-red-A | node-red-B |
| HDMI Port | Appropriate HDMI port | Appropriate HDMI port |

COM3/COM4 are examples: use the actual ports on the hardware computer. COM10 and
higher use the same plain-name format. Do not enter quotes. Leave neither adapter
in Search mode when using two adapters. Search retains the first-device behavior;
there is no automatic allocation of separate adapters.

All input/output/state nodes for adapter A should reference configuration A;
all nodes for adapter B should reference configuration B. Do not create multiple
configurations for the same COM port. HDMI Port is independent of the USB COM port.
If both state nodes write to flow context in the same flow, give them different
Flow Property names so their device state does not overwrite each other.

Deploy the flows. Each adapter should connect independently. cec-client remains
running as a background process, with its console hidden.
Warnings and errors are forwarded to Node-RED. Unexpected child exits retry after
30 seconds using the same configured port. Stopping/removing a connection cancels
retries and waits for its child to close.

## Verify the installation

- Confirm both adapter node groups become Connected and each controls only its
  intended HDMI bus/device.
- Confirm no cec-client console appears at startup or reconnect.
- Redeploy and restart Node-RED; confirm neither leaves extra clients holding ports.
- If a connection fails, record the exact Node-RED error and the installed
  Node-RED, Node.js, and libCEC versions. Do not launch a second manual client
  against an adapter while Node-RED owns it.

Automated tests use simulated child processes. Verify adapter operation on your
own hardware after installation and after upgrading libCEC.

## Rollback

Stop Node-RED. Restore the backed-up installation/user directory or reinstall the
exact previously installed module version from that directory, then restore flows
if needed and restart Node-RED.

## Packaging change in 1.0.4

JavaScript dependencies are installed by npm rather than bundled in the archive.
The adapter runtime is unchanged from 1.0.3.
