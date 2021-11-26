/**
A codec to control an Bosch AMAX with Shellies switchs

Place this file alongside your
config.json file, and add the following config:
       {
             
            "name": "AMAX",
            "accessory": "mqttthing",
            "url": "url",
            "username": "user",
            "password": "passwd",
            "type": "securitySystem",
            "codec": "ShellyAMAX.js",
            "ShellyGen": 1,
            "AMAX": {
            	"setState": {
            		"Armed": {
            			"name": "shellies/shellyuni-98CDAC25XXXX",
            			"id": 0,
            			"ACTIVE": "on"
            			},
            		"Disarmed": {
            			"name":"shellies/shellyuni-98CDAC25XXXX",
            			"id": 0,
            			"ACTIVE": "on"
            			}
            	},
            	"getState": {
            		"Armed": {
            			"name": "shellies/shellyuni-98CDAC25XXXX",
            			"id": 0,
            			"ACTIVE": 1
            			},
            		"Triggered": {
            			"name": "shellies/shellyuni-98CDAC25XXXX",
            			"id": 1,
            			"ACTIVE": 0
            			},
            		"AltTriggered": {
            			"name": "shellies/shellyuni-98CDAC25XXXX",
            			"id": 1,
            			"ACTIVE": 1
            			}
            	}
            },
            "targetStateValues": [
                "SA",
                "AA",
                "NA",
                "D"
            ],
            "currentStateValues": [
                "SA",
                "AA",
                "NA",
                "D",
                "T"
            ],
            "restrictTargetState": [
                1,
                3
            ],
            "logMqtt": true
            }



**/

function init( params ) {
    let { log, config, publish, notify } = params;   
    let target_state="?", target_time=Date.now(), current_state="?",
    	alt_trigger_state=null, AltTopic = null, msg = null,
       	relay_Arm_Topic = "/rcp",
    	relay_Disarm_Topic = relay_Arm_Topic
    	ArmTopic = "/status/input:" + config.AMAX.getState.Armed.id,
    	TrigTopic = "/status/input:" + config.AMAX.getState.Triggered.id,
   		AltTopic="/status/input:" + config.AMAX.getState.AltTriggered.id;

    // topics definition 
    if (config.ShellyGen == 1) {
    	relay_Arm_Topic = config.AMAX.setState.Armed.name + "/relay/" +
    		config.AMAX.setState.Armed.id + "/command";
    	relay_Disarm_Topic = config.AMAX.setState.Disarmed.name + "/relay/" +
    		config.AMAX.setState.Disarmed.id + "/command";
    	ArmTopic = "/input/" + config.AMAX.getState.Armed.id;
    	TrigTopic = "/input/" + config.AMAX.getState.Triggered.id;
   		AltTopic = "/input/" + config.AMAX.getState.AltTriggered.id;
	}	
    
	
	 config.topics = {
			"getCurrentState": config.AMAX.getState.Triggered.name + TrigTopic,
        	"getTargetState": config.AMAX.getState.Armed.name + ArmTopic,
        	"setTargetState": relay_Arm_Topic,
        	"getAltSensorState": config.AMAX.getState.AltTriggered.name + AltTopic
    };


    log(`Starting Bosh AMAX key switch Codec for ${config.name}
    getCurrentState: ${config.topics.getCurrentState}
    getTargetState: ${config.topics.getTargetState}
    setTargetState: ${config.topics.setTargetState}
    getAltSensorState ${config.topics.getAltSensorState}
    `);    


    function decodeAMAX( message, info, output ) { 
    	if (config.logMqtt) {
    		log(`decoding : [${info.property}] with message [${message}]`);
    	}
    	let msg = JSON.parse(message).state, d = Date.now();
        if (config.ShellyGen == 1) {
       		msg = message;
        }
   
        if (info.property == "targetState") {
            //getTargetState return targetState
            if (msg == config.AMAX.getState.Armed.ACTIVE ) {
            	target_state = "AA";
				notify(config.targetState,1);        	
            }
            else {
            // wait until AMAX get ready and wait more 5s
            	if (d - target_time > (config.AMAX.ArmingDelay + 5)*1000) {
            		target_state = "D";
          			notify(config.targetState,3);
          		}
            }
            output(target_state);
        }

        // in this case we use getCurrentState to probe triggered state
        if (info.property == "currentState") {
        log(`Checking if message = ${config.AMAX.getState.Triggered.ACTIVE}`)
       		if (msg == config.AMAX.getState.Triggered.ACTIVE ||
       			alt_trigger_state == true ) {
				current_state = "T"; current_state_id = 4;	
            	if (config.logMqtt) {
            		log(`Notifying currentState = ${current_state_id}`);
            	}
          		notify(config.currentState,current_state_id);        	
            }
            else {
            	current_state = target_state ;
          //		notify(config.currentState,3);        	
            }
			output(current_state);
		}

		// Here we use an alternate sensor to probe triggered state (like medical or silent trigger)
       if (info.property == "getAltSensorState") {
            if (msg == config.AMAX.getState.AltTriggered.ACTIVE) {
            	alt_trigger_state = true;
            	if (config.logMqtt) {log("Alternative Trigger detected , notifying !!!");}
            	notify(config.currentState,4);        	
            }
            else {
            	alt_trigger_state = false;
            	if (config.logMqtt) {log("Trigger not detected, nothing to do");}   	
            	}
			return alt_trigger_state;
		}

	}

	function encodeAMAX(message, info, output) {
    	if (config.logMqtt) {
    		log(`encoding : [${info.property}] with message [${message}]`);
    		}
    	let d = Date.now(), relay=null, relay_id=null;
    	
    	if (info.property == "targetState") {
        	if (message == target_state ) { return undefined;} // Nothing to do
        	if (message == "AA" || message == "D") {
        		// si nécessaire on publie le changement d'état
        		if (message == "AA") {
        			relay = relay_Arm_Topic;
        			relay_id = config.AMAX.setState.Armed.id;
        			notify(config.target_state,1);
        			notify(config.current_state,1);
        		}
        		else {
        			relay = relay_Disarm_Topic;
        			relay_id = config.AMAX.setState.Disarmed.id;
        			notify(config.target_state,3);
        			notify(config.current_state,3);
        		}
				// save the request and keep time
				target_state = message; target_time = d;
				// Send a pulse
				if (config.ShellyGen == 1) {
					publish(relay, config.AMAX.setState.Armed.ACTIVE);
	//				publish(Switch, config.AMAX.setState.Disarmed.ACTIVE);
				}
				else {
        			publish(Switch, JSON.stringify({'id': 123, src: 'user_1',
        				method: 'Switch.Set', params: {'id': relay_id, 'on': config.AMAX.setState.Armed.ACTIVE}}));
  //      			setTimeout(publish(Switch, JSON.stringify({id: 123, src: 'user_1',
  //      				method: 'Switch.Set', params: {id: relay_ID, on: config.AMAX.setState.Disarmed.ACTIVE}})),100);
				}
			}
		}
		return undefined;

	}

  return {
        encode: encodeAMAX,
        decode: decodeAMAX
      };
}


// export initialisation function
module.exports = {
    init
};
