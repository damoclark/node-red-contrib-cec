/**
 * cec-config
 *
 * Configuration node for node-red-contrib-cec
 *
 * node-red-contrib-cec
 *
 * 20/8/17
 *
 * Copyright (C) 2017 Damien Clark (damo.clarky@gmail.com)
 *
 * This program is free software = you can redistribute it and/or modify
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
	function CecConfigNode(n) {
		RED.nodes.createNode(this,n);
		this.OSDname = n.OSDname ;
		this.comport = n.comport ;
		this.hdmiport = n.hdmiport ;
		this.player = n.player ;
		this.recorder = n.recorder ;
		this.tuner = n.tuner ;
		this.audio = n.audio ;
		this.processManaged = false ;
		this.autorestart = true ;
		this.no_serial = {
			reconnect: false,
			wait_time: 30, //in seconds
			trigger_stop: true
		} ;
		this.id = this.comport+':'+this.hdmiport ;
	}
	RED.nodes.registerType("cec-config",CecConfigNode) ;
} ;
