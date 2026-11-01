"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {EventEmitter} = require('node:events');
const {PassThrough} = require('node:stream');

// Execute the actual runtime with a fake process boundary. Never spawn cec-client.
function load(file, overrides, globals = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const realRequire = createRequire(filename);
  const module = {exports: {}};
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports,
    require: name => Object.hasOwn(overrides, name) ? overrides[name] : realRequire(name),
    process, console, setTimeout, clearTimeout, ...globals
  }, {filename});
  return module.exports;
}

function harness() {
  const launches = [], timers = new Set(), fakeProcess = new EventEmitter();
  const Monitor = load('vendor/cec-monitor/lib/cec-monitor.js', {
    child_process: {spawn(command, args, options) {
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = () => { child.killed = true; return true; };
      launches.push({command, args: Array.from(args), options, child});
      return child;
    }}
  }, {
    process: fakeProcess,
    setTimeout(fn) { timers.add(fn); return fn; },
    clearTimeout(fn) { timers.delete(fn); }
  }).default;
  return {Monitor, launches, timers, fakeProcess,
    retry() { const pending = [...timers]; timers.clear(); pending.forEach(fn => fn()); }};
}

test('independent ports, plain COM10, path normalization, hidden launches and auto mode', () => {
  const h = harness();
  ['COM3', 'COM4', ' com10 ', '\\\\.\\COM11', '', '/dev/ttyACM0'].forEach(comport => {
    new h.Monitor('test', {comport, recorder: false, player: true, processManaged: true});
  });
  assert.deepEqual(h.launches.map(l => l.args.slice(-1)[0]),
    ['COM3', 'COM4', 'COM10', 'COM11', '1', '/dev/ttyACM0']);
  for (const launch of h.launches) {
    assert.equal(launch.command, 'cec-client');
    assert.equal(launch.options.windowsHide, true);
    assert.equal(launch.options.shell, false);
  }
});

test('failed startup retries the same port; Stop cancels retry and detaches process listeners', () => {
  const h = harness();
  const monitor = new h.Monitor('A', {comport: 'COM3', processManaged: true});
  const errors = [];
  monitor.on(h.Monitor.EVENTS._ERROR, error => errors.push(error));
  h.launches[0].child.emit('error', new Error('ENOENT'));
  h.launches[0].child.emit('close', -1);
  assert.match(errors[0], /ENOENT/);
  assert.equal(h.timers.size, 1);
  h.retry();
  assert.equal(h.launches.length, 2);
  assert.equal(h.launches[1].args.slice(-1)[0], 'COM3');
  monitor.Stop();
  assert.equal(h.launches[1].child.killed, true);
  h.launches[1].child.emit('close', 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.fakeProcess.listenerCount('exit'), 0);
  assert.equal(h.fakeProcess.listenerCount('beforeExit'), 0);
  monitor._initCecClient();
  assert.equal(h.launches.length, 2);
});

test('Stop during retry completes immediately and prevents orphan clients', () => {
  const h = harness();
  const monitor = new h.Monitor('A', {processManaged: true});
  h.launches[0].child.emit('close', 1);
  let stopped = false;
  monitor.once(h.Monitor.EVENTS._STOP, () => { stopped = true; });
  monitor.Stop();
  h.retry();
  assert.equal(stopped, true);
  assert.equal(h.launches.length, 1);
});

test('config nodes preserve Node-RED IDs even with identical port settings', () => {
  let Config;
  require('../cec/cec-config')({nodes: {
    createNode(node, config) { node.id = config.id; },
    registerType(name, constructor) { Config = constructor; }
  }});
  assert.equal(new Config({id: 'A', comport: ' COM3 '}).id, 'A');
  assert.equal(new Config({id: 'B', comport: ' COM3 '}).id, 'B');
});

test('manager is initialized once; config sharing, separate clients and partial redeploy', async () => {
  const h = harness();
  let checks = 0;
  const configs = {
    a: {id: 'a', OSDname: 'A', comport: 'COM3'},
    b: {id: 'b', OSDname: 'B', comport: 'COM4'}
  };
  const runtime = load('cec/cec.js', {
    '../vendor/cec-monitor': {CECMonitor: h.Monitor},
    'command-exists': () => { checks++; return Promise.resolve(); }
  });
  const RED = {nodes: {
    getNode(id) { return configs[id]; },
    createNode(node, config) {
      EventEmitter.call(node);
      Object.setPrototypeOf(node, EventEmitter.prototype);
      node.id = config.id;
      node.status = status => { node.lastStatus = status; };
      node.error = error => { throw new Error(error); };
      node.warn = () => {};
      node.send = () => { node.sent = (node.sent || 0) + 1; };
    }
  }};
  await Promise.all([1, 2, 3].map(() => new Promise(resolve => runtime.init(RED, resolve))));
  assert.equal(checks, 1);
  const a1 = new runtime.CecInNode({id: 'a1', cec_adapter: 'a', select_all: 'true', flow_in: true});
  const b = new runtime.CecOutNode({id: 'b', cec_adapter: 'b'});
  h.launches[0].child.stdout.write('waiting for input\n');
  const a2 = new runtime.CecOutNode({id: 'a2', cec_adapter: 'a'});
  assert.equal(h.launches.length, 2);
  assert.equal(a2.lastStatus.text, 'Connected');
  let done = 0;
  a1.emit('close', false, () => done++);
  assert.equal(done, 1);
  assert.equal(h.launches[0].child.killed, undefined);
  h.launches[0].child.stdout.write('TRAFFIC: [ 1] >> 04:90:00\n');
  assert.equal(a1.sent, undefined);
  a2.emit('close', false, () => done++);
  assert.equal(done, 1, 'wait for actual child exit before completing redeploy');
  h.launches[0].child.emit('close', 0);
  assert.equal(done, 2);
  assert.equal(h.launches[1].child.killed, undefined);
  b.emit('close', false, () => done++);
  h.launches[1].child.emit('close', 0);
  assert.equal(done, 3);
  assert.equal(h.timers.size, 0);
});
