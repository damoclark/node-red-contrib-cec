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

module.exports = function(RED) {
	"use strict" ;
	// require any external libraries we may need....
	var c = require('@senzil/cec-monitor') ;

	var CEC = c.CEC ;
	var CECMonitor = c.CECMonitor ;

	/**
	 * The Cec input node
	 *
	 * @constructor
	 */
	function CecInNode(config) {
		RED.nodes.createNode(this,config) ;
		var node = this ;

		// Retrieve the config node
		node.cec_adapter = RED.nodes.getNode(config.cec_adapter);
		node.cec_adapter.debug = false ;
		node.cec_adapter.processManaged = true ;
		node.cec_adapter.autorestart = true ;
		node.cec_adapter.no_serial = {//controls if the monitor restart cec-client when that stop after the usb was unplugged
			reconnect: true,       //enable reconnection attempts when usb is unplugged
			wait_time: 30,          //in seconds - time to do the attempt
			trigger_stop: true     //avoid trigger stop event
		} ;
		node.config = config ;
		node.config.select_all = (node.config.select_all == 'true') ;

		node.on('close', function(removed,done) {
			// tidy up any state
			if (removed) {
				// This node has been deleted
			} else {
				// This node is being restarted
			}
			monitor.Stop() ;
			done() ;
		});

		//All config options are optionals
		var monitor = new CECMonitor(node.cec_adapter.OSDname, node.cec_adapter) ;
		node.status({fill:"grey",shape:"ring",text:"Connecting"}) ;

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
			if(packet.flow === "IN" && node.config.flow_in === true
			|| packet.flow === "OUT" && node.config.flow_out === true) {
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

			// node.on('input', function(msg) {
		// 	msg.payload = msg.payload.toLowerCase() ;
		// 	node.send(msg) ;
		// }) ;
	}
	RED.nodes.registerType("cec-in",CecInNode) ;
} ;
