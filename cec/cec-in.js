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
	function CecInNode(config) {
		RED.nodes.createNode(this,config) ;
		var node = this ;

		// Retrieve the config node
		node.cec_adapter = RED.nodes.getNode(config.cec_adapter);

		node.on('close', function(removed,done) {
			// tidy up any state
			if (removed) {
				// This node has been deleted
			} else {
				// This node is being restarted
			}
			done() ;
		});
		// node.on('input', function(msg) {
		// 	msg.payload = msg.payload.toLowerCase() ;
		// 	node.send(msg) ;
		// }) ;
	}
	RED.nodes.registerType("cec-in",CecInNode) ;
} ;
