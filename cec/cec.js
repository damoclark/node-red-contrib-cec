/**
 * cec-in.js
 *
 * Node-Red CEC Input Node
 *
 * node-red-contrib-cec
 *
 * 15/8/17
 *
 * Copyright (C) 2017 Damien Clark (damo.clarky@gmail.com)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict" ;
// require any external libraries we may need....
var c = require('@damoclark/cec-monitor') ;
var pathval = require('pathval') ;

var CEC = c.CEC ;
var CECMonitor = c.CECMonitor ;
var RED = null ;

function MonManager() {
	this.monitor = {} ;
	this.node = {} ;
	this.count = {} ;
}

MonManager.prototype.init = function(node,config) {
	if(!this.node.hasOwnProperty(config.cec_adapter))
		this.node[config.cec_adapter] = node ;

	var cec_adapter = RED.nodes.getNode(config.cec_adapter);
	cec_adapter.debug = false ;
	cec_adapter.processManaged = true ;
	cec_adapter.autorestart = true ;
	cec_adapter.no_serial = {//controls if the monitor restart cec-client when that stop after the usb was unplugged
		reconnect: true,       //enable reconnection attempts when usb is unplugged
		wait_time: 30,          //in seconds - time to do the attempt
		trigger_stop: true     //avoid trigger stop event
	} ;

	if(this.count.hasOwnProperty(config.cec_adapter))
		++this.count[config.cec_adapter] ;
	else {
		this.count[config.cec_adapter] = 1 ;

		var self = this ;
		self.monitor[config.cec_adapter] = new CECMonitor(cec_adapter.OSDname, cec_adapter) ;
		// Configure handlers to log unusual events via node-red using the first node
		// provided to MonManager
		self.monitor[config.cec_adapter].on(CECMonitor.EVENTS._WARNING,function(warning) {
			self.node[config.cec_adapter].warn(warning) ;
		}) ;
		self.monitor[config.cec_adapter].on(CECMonitor.EVENTS._NOHDMICORD,function() {
			self.node[config.cec_adapter].warn('HDMI Cord has been disconnected') ;
		}) ;
		self.monitor[config.cec_adapter].on(CECMonitor.EVENTS._ERROR,function(error) {
			self.node[config.cec_adapter].error(error) ;
		}) ;
		self.monitor[config.cec_adapter].on(CECMonitor.EVENTS._NOSERIALPORT,function() {
			self.node[config.cec_adapter].error('No serial port') ;
		}) ;
	}
	return cec_adapter ;
} ;

MonManager.prototype.get = function(cec_adapter) {
	return this.monitor[cec_adapter] ;
} ;

MonManager.prototype.delete = function (cec_adapter,done) {
	if(--this.count[cec_adapter] === 0) {
		delete this.count[cec_adapter] ;
		this.monitor[cec_adapter].removeAllListeners(CECMonitor.EVENTS._STOP) ;
		this.monitor[cec_adapter].once(CECMonitor.EVENTS._STOP,function() { done() ;}) ;
		this.monitor[cec_adapter].Stop() ;
		delete this.monitor[cec_adapter] ;
		delete this.node[cec_adapter] ;
	}
	else {
		done() ;
	}
} ;

var mon = new MonManager() ;

module.exports = {
	init: function init(red) {
		if (RED === null)
			RED = red;
	},
	/**
	 * The Cec input node
	 *
	 * @constructor
	 */
	CecInNode: function CecInNode(config) {
		var node = this ;
		RED.nodes.createNode(node,config) ;

		node.status({fill:"grey",shape:"ring",text:"Connecting"}) ;

		// Retrieve the config node
		node.cec_adapter = mon.init(node,config) ;
		var monitor = mon.get(config.cec_adapter) ;
		node.config = config ;
		node.config.select_all = (node.config.select_all == 'true') ;

		node.on('close', function(removed,done) {
			// tidy up any state
			if (removed) {
				// This node has been deleted
			} else {
				// This node is being restarted
			}
			mon.delete(node.config.cec_adapter,done) ;
		});

		var ready = function() {
			node.status({fill:"green",shape:"dot",text:"Connected"}) ;
		} ;
		monitor.once(CECMonitor.EVENTS._READY, ready) ;

		monitor.on(CECMonitor.EVENTS._STOP,function () {
			node.status({fill:"red",shape:"ring",text:"Disconnected"}) ;
			monitor.once(CECMonitor.EVENTS._READY, ready) ;
		}) ;

		var send = function(packet) {
			var isAllowedIn = (packet.flow === "IN" && node.config.flow_in === true) ;
			var isAllowedOut = (packet.flow === "OUT" && node.config.flow_out === true) ;
			if(isAllowedIn || isAllowedOut) {
				node.send({payload: packet}) ;
			}
		} ;

		if(node.config.select_all === true) {
			monitor.on(CECMonitor.EVENTS._OPCODE,function(packet) {
				send(packet) ;
			}) ;
		}
		else {
			Object.keys(node.config).forEach(function (k) {
				if (CECMonitor.EVENTS.hasOwnProperty(k.toLocaleUpperCase()) && node.config[k] === true) {
					monitor.on(CECMonitor.EVENTS[k.toLocaleUpperCase()], function (packet) {
						send(packet) ;
					});
				}
			});
		}

	},
	CecOutNode: function CecOutNode(config) {
		var node = this ;
		RED.nodes.createNode(node,config) ;

		node.status({fill:"grey",shape:"ring",text:"Connecting"}) ;

		// Retrieve the config node
		node.cec_adapter = mon.init(node,config) ;
		var monitor = mon.get(config.cec_adapter) ;
		node.config = config ;

		node.on('close', function(removed,done) {
			// tidy up any state
			if (removed) {
				// This node has been deleted
			} else {
				// This node is being restarted
			}
			mon.delete(node.config.cec_adapter,done) ;
		});

		var ready = function() {
			node.status({fill:"green",shape:"dot",text:"Connected"}) ;
		} ;
		monitor.once(CECMonitor.EVENTS._READY, ready) ;

		monitor.on(CECMonitor.EVENTS._STOP,function () {
			node.status({fill:"red",shape:"ring",text:"Disconnected"}) ;
			monitor.once(CECMonitor.EVENTS._READY, ready) ;
		}) ;


		node.on('input', function(msg) {
			if(!msg.hasOwnProperty('payload'))
				return ;

			var msgs ;
			if(typeof msg.payload === 'array') {
				msgs = msg.payload ;
			}
			else if(typeof msg.payload === 'object') {
				msgs = [ msg.payload ] ;
			}
			else {
				node.warn('Invalid payload provided: '+JSON.stringify(msg)) ;
				return ;
			}
			msgs.forEach(function (m) {
				// Default to own logical address if not provided
				var s = m.source ;
				var t = m.target ;
				var o = m.opcode ;
				var a = m.args ;
				monitor.SendMessage(s,t,o,a) ;
			}) ;
		}) ;

	},
	CecStateNode: function CecStateNode(config) {
		var node = this ;
		RED.nodes.createNode(node,config) ;

		node.status({fill:"grey",shape:"ring",text:"Connecting"}) ;

		// Retrieve the config node
		node.cec_adapter = mon.init(node,config) ;
		var monitor = mon.get(config.cec_adapter) ;
		node.config = config ;

		node.on('close', function(removed,done) {
			// tidy up any state
			if (removed) {
				// This node has been deleted
			} else {
				// This node is being restarted
			}
			mon.delete(node.config.cec_adapter,done) ;
		});

		var ready = function() {
			if(node.config.scan) {
				monitor.WriteRawMessage('scan') ;
			}
			node.status({fill:"green",shape:"dot",text:"Connected"}) ;
		} ;
		monitor.once(CECMonitor.EVENTS._READY, ready) ;

		monitor.on(CECMonitor.EVENTS._STOP,function () {
			node.status({fill:"red",shape:"ring",text:"Disconnected"}) ;
			monitor.once(CECMonitor.EVENTS._READY, ready) ;
		}) ;

		// Do we update the flow property on receipt of every opcode from CEC bus?
		if(node.config.flow) {
			monitor.on(CECMonitor.EVENTS._OPCODE,function(packet) {
					var s = monitor.GetState() ;
					var flowContext = node.context().flow ;
					flowContext.set(node.config.flow_name,s) ;
			}) ;
		}

		node.on('input', function(msg) {

			// What information from the state do they want, and send it on
			var address = (msg.address || msg.address === 0) ? msg.address : undefined ;
			var state = monitor.GetState(address) ;

			// Update our message
			pathval.setPathValue(msg,node.config.output,state) ;
			node.send(msg) ;
		}) ;

	}
} ;
