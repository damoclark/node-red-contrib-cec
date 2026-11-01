'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _child_process = require('child_process');

var _events = require('events');

var _eventStream = require('event-stream');

var _eventStream2 = _interopRequireDefault(_eventStream);

var _HDMICEC = require('./HDMI-CEC.1.4');

var _HDMICEC2 = _interopRequireDefault(_HDMICEC);

var _death = require('death');

var _death2 = _interopRequireDefault(_death);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Created by pablo on 6/13/17.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                */

var CECMonitor = function (_EventEmitter) {
  _inherits(CECMonitor, _EventEmitter);

  function CECMonitor(OSDName, options) {
    _classCallCheck(this, CECMonitor);

    var _this = _possibleConstructorReturn(this, (CECMonitor.__proto__ || Object.getPrototypeOf(CECMonitor)).call(this));

    _this.GetState = function (address) {
      address = parseAddress.call(this, address, undefined);

      // Return copy of our state information
      if (address === undefined) {
        return JSON.parse(JSON.stringify(this.cache));
      }
      return JSON.parse(JSON.stringify(this.cache[address]));
    }.bind(_this);

    _this.GetPhysicalAddress = function () {
      return this.address.physical;
    }.bind(_this);

    _this.GetLogicalAddress = function () {
      return this.address.primary;
    }.bind(_this);

    _this.GetLogicalAddresses = function () {
      return [].concat(Object.keys(this.address.logical));
    }.bind(_this);

    _this.Logical2Physical = function (logical) {
      logical = parseAddress.call(this, logical, null);

      if (logical === null) {
        return null;
      }
      return this.cache[logical].physical;
    }.bind(_this);

    _this.Physical2Logical = function (physical) {
      physical = parseAddress.call(this, physical, null);
      return physical;
    }.bind(_this);

    _this.GetOSDName = function (address) {
      address = parseAddress.call(this, address, null);

      if (address === null) {
        return '';
      }
      return this.cache[address].osdname;
    }.bind(_this);

    _this.GetPowerStatus = function (address) {
      address = parseAddress.call(this, address, null);

      if (address === null) {
        return null;
      }
      return this.cache[address].power;
    }.bind(_this);

    _this.GetPowerStatusName = function (address) {
      var power = this.GetPowerStatus(address);

      if (power === null) {
        return power;
      }
      return _HDMICEC2.default.PowerStatusNames[power];
    }.bind(_this);

    _this.GetActiveSource = function () {
      return this.active_source;
    }.bind(_this);

    _this.WriteRawMessage = function (raw) {
      var _this2 = this;

      return this.isReady.then(function () {
        return _this2.client.stdin.write(raw + '\n');
      }).catch(function (e) {
        console.log('the cec adapter is not ready');
        console.log(e);
      });
    }.bind(_this);

    _this.SendMessage = function (source, target, opcode, args) {
      source = parseAddress.call(this, source, this.GetLogicalAddress());

      target = parseAddress.call(this, target, _HDMICEC2.default.LogicalAddress.BROADCAST);

      if (typeof opcode === 'string') {
        if (opcode.indexOf('0x') === 0) {
          opcode = parseInt(opcode, 16);
        } else if (_HDMICEC2.default.Opcode.hasOwnProperty(opcode.toLocaleUpperCase())) {
          opcode = _HDMICEC2.default.Opcode[opcode.toLocaleUpperCase()];
        }
      }

      if (typeof args === 'string') {
        // If a phyiscal address
        if (isPhysical(args)) {
          args = physical2args(args);
        } else if (args.indexOf('0x') === 0) {
          args = parseInt(args, 16);
        }
        // Otherwise treat as string argument
        else {
            args = args.split('').map(function (s) {
              return s.charCodeAt(0);
            });
          }
      }
      // todo: Create classes for complex operations (EG. SELECT_DIGITAL_SERVICE), that can be provided and generate their own arguments array
      // else if(typeof args === 'object' && args instanceof Command)
      return this.WriteMessage(source, target, opcode, args);
    };

    _this.WriteMessage = function (source, target, opcode, args) {
      var msg = 'tx ' + [(source << 4) + target, opcode].concat(args || []).map(function (h) {
        return ('0' + h.toString(16)).substr(-2);
      }).join(':');
      return this.WriteRawMessage(msg);
    }.bind(_this);

    // Local process lifecycle: Stop is terminal; reconnects retain the same port.
    _this.Stop = function () {
      this.stopped = true;
      this.ready = false;
      clearTimeout(this.restartTimer);
      process.removeListener('beforeExit', this.Stop);
      process.removeListener('exit', this.Stop);
      if (this.client) {
        this.client.kill('SIGINT');
      } else {
        this.emit(CECMonitor.EVENTS._STOP);
      }
    }.bind(_this);

    _this._initCecClient = function () {
      if (this.stopped || this.client) return;
      this.restartTimer = null;
      this.ready = false;
      var client = this.client = (0, _child_process.spawn)('cec-client', this.params, {
        windowsHide: true,
        shell: false
      });
      client.stdout.pipe(_eventStream2.default.split()).pipe(_eventStream2.default.map(this._processStdOut));
      client.stderr.pipe(_eventStream2.default.split()).on('data', function (line) {
        if (line) this.emit(CECMonitor.EVENTS._ERROR, line);
      }.bind(this));
      client.on('error', function (error) {
        this.emit(CECMonitor.EVENTS._ERROR, 'Unable to start cec-client: ' + error.message);
      }.bind(this));
      client.once('close', function () { this._onClose(client); }.bind(this));
    }.bind(_this);

    _this._onClose = function (client) {
      if (this.client !== client) return;
      this.client = null;
      this.ready = false;
      this.emit(CECMonitor.EVENTS._STOP);
      if (!this.stopped && (this.autorestart || this.no_serial.reconnect)) {
        this.restartTimer = setTimeout(this._initCecClient, this.no_serial.wait_time * 1000);
      }
    }.bind(_this);

    _this._checkReady = function (resolve) {
      var _this3 = this;

      if (this.stopped) return;
      if (this.ready) {
        return resolve();
      }

      setTimeout(function () {
        return _this3._checkReady(resolve);
      }, 1000);
    }.bind(_this);

    _this._processStdOut = function (data, cb) {
      if (/^TRAFFIC:.*/g.test(data)) {
        this._processTraffic(data);
      } else if (/^DEBUG:.*/g.test(data)) {
        this._processDebug(data);
      } else if (/^NOTICE:.*/g.test(data)) {
        this._processNotice(data);
      } else if (/^waiting for input.*/g.test(data)) {
        this.autorestarting = false;
        this.recconnect_intent = false;
        this.ready = true;
        this.emit(CECMonitor.EVENTS._READY);
      } else if (/^WARNING:.*/g.test(data)) {
        this._processWarning(data);
      } else if (/^ERROR:.*/g.test(data)) {
        this._processError(data);
      } else if (/(^no serial port given\. trying autodetect: FAILED)|(^Connection lost)/g.test(data)) {
        if (this.no_serial.reconnect) {
          this.recconnect_intent = true;
          this.ready = false;
        }
        this.emit(CECMonitor.EVENTS._NOSERIALPORT);
      }

      this.emit(CECMonitor.EVENTS._DATA, data);
      cb(null, data);
    }.bind(_this);

    _this._readPacket = function (plain) {
      var regex = /^(TRAFFIC|DEBUG):[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]\[[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*([0-9]*)\][\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF](<<|>>)[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF](([0-9A-Z_a-z]{2}:?)+)$/g;
      var match = regex.exec(plain);
      if (match) {

        var tokens = match[4].split(':').map(function (h) {
          return parseInt(h, 16);
        });

        var packet = {
          type: match[1],
          number: match[2],
          flow: match[3] === '>>' ? 'IN' : 'OUT',
          source: (tokens[0] & 0xF0) >> 4,
          target: tokens[0] & 0x0F,
          opcode: tokens[1],
          args: tokens.slice(2)
        };

        this.emit(CECMonitor.EVENTS._PACKET, packet);
        return packet;
      }

      return null;
    }.bind(_this);

    _this._processTraffic = function (data) {

      this.emit(CECMonitor.EVENTS._TRAFFIC, data);

      var packet = this._readPacket(data);

      if (packet) {
        if (packet.flow === 'IN') {
          this.emit(CECMonitor.EVENTS._RECEIVED, packet);
        } else {
          this.emit(CECMonitor.EVENTS._SENDED, packet);
        }
        if (!packet.opcode) {
          this.emit(CECMonitor.EVENTS.POLLING_MESSAGE, packet);
        } else {
          this._processEvents(packet);
        }
      }
    }.bind(_this);

    _this._processEvents = function (packet) {
      var _this4 = this;

      var data = {};
      var physical = void 0,
          source = void 0,
          version = void 0,
          status = void 0,
          id = void 0,
          vendor = void 0,
          from = void 0,
          to = void 0,
          osdname = void 0;

      // Store opcode name as event property
      packet.event = _HDMICEC2.default.OpcodeNames[packet.opcode];

      switch (packet.opcode) {
        case _HDMICEC2.default.Opcode.ACTIVE_SOURCE:
          if (packet.args.length !== 2) {
            return this.emit(CECMonitor.EVENTS._ERROR, 'opcode command ACTIVE_SOURCE with bad formated address');
          }
          source = packet.args[0] << 8 | packet.args[1];
          physical = args2physical(packet.args);
          // Update our records
          this.active_source = physical;
          data = {
            val: source,
            str: physical
          };
          break;

        case _HDMICEC2.default.Opcode.CEC_VERSION:
          if (packet.args.length !== 1) {
            return this.emit(CECMonitor.EVENTS._ERROR, 'opcode command CEC_VERSION without version');
          }
          version = packet.args[0];
          data = {
            val: version,
            str: _HDMICEC2.default.CECVersionNames[version]
          };
          break;

        // todo: untested
        case _HDMICEC2.default.Opcode.DECK_STATUS:
          if (packet.args.length !== 2) {
            return this.emit(CECMonitor.EVENTS._ERROR, 'opcode command DECK_STATUS without Deck Info');
          }
          status = packet.args[0] << 8 | packet.args[1];
          data = {
            val: status,
            str: _HDMICEC2.default.DeckStatusNames[status]
          };
          break;

        case _HDMICEC2.default.Opcode.DEVICE_VENDOR_ID:
          if (packet.args.length !== 3) {
            return this.emit(CECMonitor.EVENTS._ERROR, 'opcode command DEVICE_VENDOR_ID with bad arguments');
          }
          id = packet.args[0] << 16 | packet.args[1] << 8 | packet.args[2];
          vendor = _HDMICEC2.default.VendorIdNames[id];
          data = {
            val: id,
            str: vendor
          };
          break;

        case _HDMICEC2.default.Opcode.REPORT_PHYSICAL_ADDRESS:
          if (packet.args.length !== 3) {
            return this.emit(CECMonitor.EVENTS._ERROR, 'opcode command REPORT_PHYSICAL_ADDRESS with bad formated address or device type');
          }
          source = packet.args[0] << 8 | packet.args[1];
          physical = args2physical(packet.args);
          // Update our records
          this.cache[packet.source].physical = physical;
          this.p2l[physical] = packet.source;
          data = {
            val: source,
            str: physical
            // If we have received a REPORT_PHYSICAL_ADDRESS from TV
            // to broadcast, then query all devices for power status
          };if (packet.target == 15 && packet.source == 0) {
            queryPowerStatus.call(this, packet.target);
          }
          break;

        case _HDMICEC2.default.Opcode.REPORT_POWER_STATUS:
          if (packet.args.length !== 1) {
            return this.emit(CECMonitor.EVENTS._ERROR, 'opcode command REPORT_POWER_STATUS with bad formated power status');
          }
          status = packet.args[0];
          // Update our records
          this.cache[packet.source].power = status;
          data = {
            val: status,
            str: _HDMICEC2.default.PowerStatusNames[status]
          };
          break;

        case _HDMICEC2.default.Opcode.ROUTING_CHANGE:
          if (packet.args.length !== 4) {
            return this.emit(CECMonitor.EVENTS._ERROR, 'opcode command ROUTING_CHANGE with bad formated addresses');
          }
          from = packet.args[0] << 8 | packet.args[1];
          to = packet.args[2] << 8 | packet.args[3];
          // Update our records
          this.active_source = args2physical(packet.args.slice(2, 4));
          data = {
            from: {
              val: from,
              str: args2physical(packet.args.slice(0, 2))
            },
            to: {
              val: to,
              str: args2physical(packet.args.slice(2, 4))
            }
          };
          break;

        case _HDMICEC2.default.Opcode.SET_OSD_NAME:
          if (!packet.args.length) {
            return this.emit(CECMonitor.EVENTS._ERROR, 'opcode command SET_OSD_NAME without OSD NAME');
          }
          osdname = String.fromCharCode.apply(null, packet.args);
          // Update our records
          this.cache[packet.source].osdname = osdname;
          data = {
            val: osdname,
            str: osdname
          };
          break;

        case _HDMICEC2.default.Opcode.STANDBY:
          if (packet.args.length !== 0) {
            return this.emit(CECMonitor.EVENTS._ERROR, 'opcode command STANDBY with bad args');
          }
          // If we have received a standby, query devices for power status
          queryPowerStatus.call(this, packet.target);
          break;

        case _HDMICEC2.default.Opcode.IMAGE_VIEW_ON:
        case _HDMICEC2.default.Opcode.TEXT_VIEW_ON:
          if (packet.args.length !== 0) {
            return this.emit(CECMonitor.EVENTS._ERROR, 'opcode command IMAGE_VIEW_ON with bad args');
          }
          // If we have received an image_view_on, query device for power status
          setTimeout(function () {
            _this4.SendMessage(null, packet.target, _HDMICEC2.default.Opcode.GIVE_DEVICE_POWER_STATUS);
          }, 3000);
          break;
      }

      packet.data = data;
      if (packet.event !== null) {
        // Emit all OPCODE events to '_opcode' event
        this.emit(CECMonitor.EVENTS._OPCODE, packet);

        return this.emit(packet.event, packet);
      }
    };

    _this._processNotice = function (data) {
      var _this5 = this;

      var regexLogical = /logical[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]address\(es\)[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]=[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF](Recorder[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF][0-9][\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]|Playback[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF][0-9][\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]|Tuner[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF][0-9][\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]|Audio[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF])\(?([0-9])\)/g;
      var match = regexLogical.exec(data);
      if (match) {
        this.address.primary = parseInt(match[2], 10);
        this.cache[this.address.primary].osdname = this.OSDName;
        this.address.logical = {};
        while (match) {
          this.address.logical[match[2]] = true;
          this.cache[match[2]].osdname = this.OSDName;
          match = regexLogical.exec(data);
        }
      }

      var regexDevice = /base[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]device:[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF][0-9A-Z_a-z]+[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]\(([0-9]{1,2})\),[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]HDMI[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]port[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]number:[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]([0-9]{1,2}),/g;
      match = regexDevice.exec(data);
      if (match) {
        this.address.base = parseInt(match[1], 10);
        this.address.hdmi = parseInt(match[2], 10);
      }

      var regexPhysical = /physical[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]address:[\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]([\.0-9A-Z_a-z]+)/g;
      match = regexPhysical.exec(data);
      if (match) {
        this.address.physical = match[1];
        Object.keys(this.address.logical).forEach(function (s) {
          _this5.cache[s].physical = _this5.address.physical;
          _this5.p2l[_this5.address.physical] = s;
        });
      }

      return this.emit(CECMonitor.EVENTS._NOTICE, data);
    }.bind(_this);

    _this._processDebug = function (data) {
      if (/TRANSMIT_FAILED_ACK/g.test(data)) {
        return this.emit(CECMonitor.EVENTS._NOHDMICORD);
      }
      if (this.debug) {
        return this.emit(CECMonitor.EVENTS._DEBUG, data);
      }
    }.bind(_this);

    _this._processWarning = function (data) {
      if (/COMMAND_REJECTED/g.test(data)) {
        this.ready = false;
        this.autorestarting = true;
        if (this.client) this.client.kill('SIGINT');
      }
      return this.emit(CECMonitor.EVENTS._WARNING, data);
    }.bind(_this);

    _this._processError = function (data) {
      return this.emit(CECMonitor.EVENTS._ERROR, data);
    }.bind(_this);

    _this.ready = false;
    _this.autorestarting = false;
    _this.OSDName = OSDName || 'cec-monitor';
    _this.autorestart = options.autorestart !== false;
    _this.stopped = false;
    _this.restartTimer = null;
    _this.address = {
      primary: _HDMICEC2.default.LogicalAddress.UNKNOWN,
      physical: 0xFFFF,
      logical: {},
      base: _HDMICEC2.default.LogicalAddress.UNKNOWN,
      hdmi: options.hdmiport || 1
    };
    _this.no_serial = {
      reconnect: false,
      wait_time: 30, //in seconds
      trigger_stop: false
    };
    _this.no_serial = Object.assign(_this.no_serial, options.no_serial);
    _this.recconnect_intent = false;
    _this.debug = options.debug;

    // Cache of data about logical addresses
    _this.cache = {
      0: {
        physical: '0.0.0.0',
        power: null,
        osdname: 'TV'
      },
      1: {
        physical: null,
        power: null,
        osdname: ''
      },
      2: {
        physical: null,
        power: null,
        osdname: ''
      },
      3: {
        physical: null,
        power: null,
        osdname: ''
      },
      4: {
        physical: null,
        power: null,
        osdname: ''
      },
      5: {
        physical: null,
        power: null,
        osdname: ''
      },
      6: {
        physical: null,
        power: null,
        osdname: ''
      },
      7: {
        physical: null,
        power: null,
        osdname: ''
      },
      8: {
        physical: null,
        power: null,
        osdname: ''
      },
      9: {
        physical: null,
        power: null,
        osdname: ''
      },
      10: {
        physical: null,
        power: null,
        osdname: ''
      },
      11: {
        physical: null,
        power: null,
        osdname: ''
      },
      12: {
        physical: null,
        power: null,
        osdname: ''
      },
      13: {
        physical: null,
        power: null,
        osdname: ''
      },
      14: {
        physical: null,
        power: null,
        osdname: ''
      },
      15: {
        physical: null,
        power: null,
        osdname: ''
      }
      // Maintain index pf physical addresses mapped to logical address
    };_this.p2l = {
      '0.0.0.0': 0
    };
    _this.active_source = null; // Default not known

    process.on('beforeExit', _this.Stop);
    process.on('exit', _this.Stop);

    if (!options.processManaged) {
      (0, _death2.default)({ uncaughtException: true })(function (signal, err) {
        if (err) {
          console.error(err);
        }
        process.exit();
      });
    }

    _this.params = [];
    if (options.recorder !== false) {
      _this.params.push('-t', 'r');
    }

    if (options.player === true) {
      _this.params.push('-t', 'p');
    }

    if (options.tuner === true) {
      _this.params.push('-t', 't');
    }

    if (options.audio === true) {
      _this.params.push('-t', 'a');
    }

    _this.params.push('-o', _this.OSDName, '-d', '31', '-p', _this.address.hdmi.toString());

    var port = (options.comport || '').trim();
    // libCEC adds the Windows device-path prefix itself.
    port = port.replace(/^\\\\\.\\(?=COM[0-9]+$)/i, '');
    if (/^COM[0-9]+$/i.test(port)) port = port.toUpperCase();
    if (port) _this.params.push(port);
    _this._initCecClient();
    return _this;
  }

  _createClass(CECMonitor, [{
    key: 'isReady',


    /**
     * Resolves promise when ready cec-client for commands
     * @return {Promise} Resolves when ready
     */
    get: function get() {
      return new Promise(this._checkReady);
    }

    /**
     * Get copy of internal state information on CEC bus
     *
     * @param {number|string} [address] Optional address to request state for.
     * (physical, logical or CEC.LogicalAddress names)
     * If omitted, return an array of all addresses indexed by logical address
     *
     * @return {object|array[object]} An object or array of objects
     * @see WriteMessage
     * with index as the logical device address and/or values an object
     * representing state of the logical address
     */


    /**
     * Get physical address of this instance
     * @return {string} Physical address used by this instance
     */


    /**
     * Get first logical address of this device
     * @return {number} First logical address used by this instance
     */


    /**
     * Get all logical addresses of this device
     * @return {array[number]} Primary logical address used by this instance
     */


    /**
     * Get the physical address from logical address
     * @param {number} logical
     * @return {string|null}
     */


    /**
     * Get logical address from physical address
     * @param {string} physical
     * @return {number|null}
     */


    /**
     * Get OSD name for given address
     * @param {string|number} address (physical, logical or CEC.LogicalAddress names)
     * @see WriteMessage
     * @return {string}
     */


    /**
     * Get power status for given address
     * @param {string|number} address (physical, logical or CEC.LogicalAddress names)
     * @see WriteMessage
     * @return {number|null}
     */


    /**
     * Get power status for given address as string
     * @param {string|number} address (physical, logical or CEC.LogicalAddress names)
     * @see WriteMessage
     * @return {string|null}
     */


    /**
     * Retrieve physical address of currently selected source
     *
     * @return {string} Physical address of the source currently selected
     */


    /**
     * Send a 'tx' message on CEC bus
     *
     * @param {string|number|null} source Logical address for source of message (defaults to own address if null)
     * @param {string|number} target Logical address for target of message (defaults to broadcast if null)
     * @param {string|number} opcode Opcode for message expressed as a byte value or STRING label
     * @param {string|number|array[number]} [args] Optional arguments for opcode, type depending on opcode
     * @example
     * monitor.SendMessage(CEC.LogicalAddress.PLAYBACKDEVICE1, CEC.LogicalAddress.BROADCAST, CEC.Opcode.SET_OSD_NAME,[0x46,0x72,0x69,0x73,0x62,0x65,0x65]);
     * @example
     * monitor.SendMessage(4, 15, 70, [70,114,105,115,98,101,101];
     * @example
     * monitor.SendMessage('0x4', '0xF', '0x46', [0x46,0x72,0x69,0x73,0x62,0x65,0x65]);
     * @example
     * monitor.SendMessage('PLAYBACKDEVICE1','BROADCAST','SET_OSD_NAME','Frisbee');
     * @example
     * monitor.SendMessage('playbackdevice1', 'broadcast', 'set_osd_name','Frisbee');
     * @example
     * // Can specify physical address as string, using dot notation
     * monitor.SendMessage(CEC.LogicalAddress.UNREGISTERED, CEC.LogicalAddress.BROADCAST, CEC.Opcode.ACTIVE_SOURCE,'2.0.0.0');
     * // Or as an array of bytes
     * monitor.SendMessage(CEC.LogicalAddress.UNREGISTERED, CEC.LogicalAddress.BROADCAST, CEC.Opcode.ACTIVE_SOURCE,[0x20,0x0]);
     * @example
     * // Default source is the client - default destination is broadcast
     * monitor.SendMessage(null,null, 'set_osd_name','Frisbee');
     * @see cec
     * @see WriteMessage
     * @return {Promise} When promise is resolved, the message is sent, otherwise if rejected, the cec adapter is not ready
     */

  }], [{
    key: 'EVENTS',
    get: function get() {
      return {
        _DATA: '_data',
        _DEBUG: '_debug',
        _ERROR: '_error',
        _NOTICE: '_notice',
        _PACKET: '_packet',
        _READY: '_ready',
        _RECEIVED: '_received',
        _SENDED: '_sended',
        _STOP: '_stop',
        _TRAFFIC: '_traffic',
        _OPCODE: '_opcode',
        _WARNING: '_warning',
        _NOSERIALPORT: '_no_serial_port',
        _NOHDMICORD: '_no_hdmi_cord',

        ABORT: 'ABORT',
        ACTIVE_SOURCE: 'ACTIVE_SOURCE',
        CEC_VERSION: 'CEC_VERSION',
        CLEAR_ANALOGUE_TIMER: 'CLEAR_ANALOGUE_TIMER',
        CLEAR_DIGITAL_TIMER: 'CLEAR_ANALOGUE_TIMER',
        CLEAR_EXTERNAL_TIMER: 'CLEAR_EXTERNAL_TIMER',
        DECK_CONTROL: 'DECK_CONTROL',
        DECK_STATUS: 'DECK_STATUS',
        DEVICE_VENDOR_ID: 'DEVICE_VENDOR_ID',
        FEATURE_ABORT: 'FEATURE_ABORT',
        GET_CEC_VERSION: 'GET_CEC_VERSION',
        GET_MENU_LANGUAGE: 'GET_MENU_LANGUAGE',
        GIVE_AUDIO_STATUS: 'GIVE_AUDIO_STATUS',
        GIVE_DECK_STATUS: 'GIVE_DECK_STATUS',
        GIVE_DEVICE_POWER_STATUS: 'GIVE_DEVICE_POWER_STATUS',
        GIVE_DEVICE_VENDOR_ID: 'GIVE_DEVICE_VENDOR_ID',
        GIVE_OSD_NAME: 'GIVE_OSD_NAME',
        GIVE_PHYSICAL_ADDRESS: 'GIVE_PHYSICAL_ADDRESS',
        GIVE_SYSTEM_AUDIO_MODE_STATUS: 'GIVE_SYSTEM_AUDIO_MODE_STATUS',
        GIVE_TUNER_DEVICE_STATUS: 'GIVE_TUNER_DEVICE_STATUS',
        IMAGE_VIEW_ON: 'IMAGE_VIEW_ON',
        INACTIVE_SOURCE: 'INACTIVE_SOURCE',
        MENU_REQUEST: 'MENU_REQUEST',
        MENU_STATUS: 'MENU_STATUS',
        PLAY: 'PLAY',
        POLLING_MESSAGE: 'POLLING_MESSAGE',
        RECORD_OFF: 'RECORD_OFF',
        RECORD_ON: 'RECORD_ON',
        RECORD_STATUS: 'RECORD_STATUS',
        RECORD_TV_SCREEN: 'RECORD_TV_SCREEN',
        REPORT_AUDIO_STATUS: 'REPORT_AUDIO_STATUS',
        REPORT_PHYSICAL_ADDRESS: 'REPORT_PHYSICAL_ADDRESS',
        REPORT_POWER_STATUS: 'REPORT_POWER_STATUS',
        REQUEST_ACTIVE_SOURCE: 'REQUEST_ACTIVE_SOURCE',
        ROUTING_CHANGE: 'ROUTING_CHANGE',
        ROUTING_INFORMATION: 'ROUTING_INFORMATION',
        SELECT_ANALOGUE_SERVICE: 'SELECT_ANALOGUE_SERVICE',
        SELECT_DIGITAL_SERVICE: 'SELECT_DIGITAL_SERVICE',
        SET_ANALOGUE_TIMER: 'SET_ANALOGUE_TIMER',
        SET_AUDIO_RATE: 'SET_AUDIO_RATE',
        SET_DIGITAL_TIMER: 'SET_DIGITAL_TIMER',
        SET_EXTERNAL_TIMER: 'SET_EXTERNAL_TIMER',
        SET_MENU_LANGUAGE: 'SET_MENU_LANGUAGE',
        SET_OSD_NAME: 'SET_OSD_NAME',
        SET_OSD_STRING: 'SET_OSD_STRING',
        SET_STREAM_PATH: 'SET_STREAM_PATH',
        SET_SYSTEM_AUDIO_MODE: 'SET_SYSTEM_AUDIO_MODE',
        SET_TIMER_PROGRAM_TITLE: 'SET_TIMER_PROGRAM_TITLE',
        STANDBY: 'STANDBY',
        SYSTEM_AUDIO_MODE_REQUEST: 'SYSTEM_AUDIO_MODE_REQUEST',
        SYSTEM_AUDIO_MODE_STATUS: 'SYSTEM_AUDIO_MODE_STATUS',
        TEXT_VIEW_ON: 'TEXT_VIEW_ON',
        TIMER_CLEARED_STATUS: 'TIMER_CLEARED_STATUS',
        TIMER_STATUS: 'TIMER_STATUS',
        TUNER_DEVICE_STATUS: 'TUNER_DEVICE_STATUS',
        TUNER_STEP_DECREMENT: 'TUNER_STEP_DECREMENT',
        TUNER_STEP_INCREMENT: 'TUNER_STEP_INCREMENT',
        USER_CONTROL_PRESSED: 'USER_CONTROL_PRESSED',
        USER_CONTROL_RELEASE: 'USER_CONTROL_RELEASE',
        VENDOR_COMMAND: 'VENDOR_COMMAND',
        VENDOR_COMMAND_WITH_ID: 'VENDOR_COMMAND_WITH_ID',
        VENDOR_REMOTE_BUTTON_DOWN: 'VENDOR_REMOTE_BUTTON_DOWN',
        VENDOR_REMOTE_BUTTON_UP: 'VENDOR_REMOTE_BUTTON_UP'
      };
    }
  }]);

  return CECMonitor;
}(_events.EventEmitter);

/**
 * Convert array of values from CEC into string formatted physical address
 * @param {number[]} value An array of byte values
 * @return {string} Physical address in . notation ie 0.0.0.0
 */


exports.default = CECMonitor;
function args2physical(value) {
  var v = value[0] << 8 | value[1];

  return ['0', '0', '0', '0'].concat(v.toString(16).toLocaleUpperCase().split('')).slice(-4).join('.');
}

/**
 * Convert string formatted phyiscal address of form 0.0.0.0 to two-byte array
 *
 * @param {string} address Physical address to convert
 * @return {number[]} A two-byte encoded verstion represented as an array
 */
function physical2args(address) {
  var s = address.split('.').join('');
  var v = parseInt(s, 16);
  var arr = [];

  arr.unshift(v & 0xFF);
  v >>= 8;
  arr.unshift(v & 0xFF);
  return arr;
}

/**
 * Determine if provided string matches a CEC physical address
 * @param {string} address Address to test
 * @return {boolean} True if it matches form 0.0.0.0 otherwise false
 */
function isPhysical(address) {
  if (typeof address !== 'string') return false;

  return address.toString().match(/^(?:\d+\.){3}\d+$/) !== null;
}

/**
 * Parse any address format and convert to logical address
 * @param {number|string} address Address to parse/convert to logical address
 * @param {number} def Default logical address if address invalid
 */
function parseAddress(address, def) {
  if (typeof address === 'string') {
    if (address.indexOf('0x') === 0) {
      address = parseInt(address, 16);
    } else if (isPhysical(address)) {
      address = this.p2l.hasOwnProperty(address) ? this.p2l[address] : def;
    } else if (_HDMICEC2.default.LogicalAddress.hasOwnProperty(address.toLocaleUpperCase())) {
      address = _HDMICEC2.default.LogicalAddress[address.toLocaleUpperCase()];
    }
  }

  if (isNaN(address) || address === null) {
    address = def;
  } else if (address > 15 || address < 0) {
    address = def;
  }
  return address;
}

/**
 * Send message to query the power status of one or all devices
 * @param {number} target Logical address to query or if BROADCAST, query each in turn
 */
function queryPowerStatus(target) {
  var _this6 = this;

  target = Number.parseInt(target);
  var logic = target == 15 ? Object.keys(this.cache) : [target];
  setTimeout(function () {
    logic.forEach(function (t) {
      var phys = _this6.GetState(t).physical;
      // Skip self or logical that has no physical address
      if (_this6.GetLogicalAddresses().includes(t) || phys === null) {
        return;
      }
      _this6.SendMessage(null, t, _HDMICEC2.default.Opcode.GIVE_DEVICE_POWER_STATUS);
    });
  }, 5000);
}
