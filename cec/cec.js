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
var c = require('@senzil/cec-monitor') ;

var CEC = c.CEC ;
var CECMonitor = c.CECMonitor ;
var RED = null ;

function MonManager() {
	this.state = {} ;
}

MonManager.prototype.init = function(config) {
	var cec_adapter = RED.nodes.getNode(config.cec_adapter);
	if(!this.state.hasOwnProperty(config.cec_adapter)) {
		this.state[config.cec_adapter] = new CECMonitor(cec_adapter.OSDname, cec_adapter) ;
	}
	cec_adapter.debug = false ;
	cec_adapter.processManaged = true ;
	cec_adapter.autorestart = true ;
	cec_adapter.no_serial = {//controls if the monitor restart cec-client when that stop after the usb was unplugged
		reconnect: true,       //enable reconnection attempts when usb is unplugged
		wait_time: 30,          //in seconds - time to do the attempt
		trigger_stop: true     //avoid trigger stop event
	} ;
	return cec_adapter ;
} ;

MonManager.prototype.get = function(cec_adapter) {
	return this.state[cec_adapter] ;
} ;

MonManager.prototype.delete = function (cec_adapter) {
	if(this.state.hasOwnProperty(cec_adapter)) {
		this.state[cec_adapter].Stop() ;
		delete this.state[cec_adapter] ;
	}
} ;

var mon = new MonManager() ;

var state = {} ;

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
		node.cec_adapter = mon.init(config) ;
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
			mon.delete(config.cec_adapter) ;
			done() ;
		});

		var ready = function() {
			node.warn("Node config:"+JSON.stringify(node.config)) ;
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
			node.warn('Setting up select_all') ;
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

		// monitor.on(CECMonitor.EVENTS._DEBUG, function(data) {
		// 	// set 'debug: true' on new CECMonitor
		// 	node.warn("sending: "+JSON.stringify(data)) ;
		// });

	},
	CecOutNode: function CecOutNode(config) {
		var node = this ;
		RED.nodes.createNode(node,config) ;

		node.status({fill:"grey",shape:"ring",text:"Connecting"}) ;

		// Retrieve the config node
		node.cec_adapter = mon.init(config) ;
		var monitor = mon.get(config.cec_adapter) ;
		node.config = config ;

		node.on('close', function(removed,done) {
			// tidy up any state
			if (removed) {
				// This node has been deleted
			} else {
				// This node is being restarted
			}
			mon.delete(config.cec_adapter) ;
			done() ;
		});

		var ready = function() {
			node.warn("Node config:"+JSON.stringify(node.config)) ;
			node.status({fill:"green",shape:"dot",text:"Connected"}) ;
		} ;
		monitor.once(CECMonitor.EVENTS._READY, ready) ;

		monitor.on(CECMonitor.EVENTS._STOP,function () {
			node.status({fill:"red",shape:"ring",text:"Disconnected"}) ;
			monitor.once(CECMonitor.EVENTS._READY, ready) ;
		}) ;


		node.on('input', function(msg) {
			node.warn('send: '+JSON.stringify(msg.payload)) ;
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
	CecStateNode: function CecStateNode() {

	}
} ;
