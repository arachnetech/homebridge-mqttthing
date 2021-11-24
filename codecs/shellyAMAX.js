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
            "AMAXswitch_ARM": "shellies/shellyuni-98CDAC25XXXX",
            "AMAXswitch_ARM_ID": 0,
            "AMAXswitch_DISARM": "shellies/shellyuni-98CDAC2XXXX",
            "AMAXswitch_DISARM_ID": 0,
            "AMAXsensor_ARM": "shellies/shellyuni-98CDACXXXX",
            "AMAXsensor_ARM_ID": 0,
            "AMAXsensor_ARMEDState": 1,
            "AMAXsensor_TRIG": "shellies/shellyuni-98CDAC2XXXX",
            "AMAXsensor_TRIG_ID": 1,
            "AMAXsensor_TriggeredState": 0,
            "AMAXsensor_Alt": "shellies/shellyuni-98CDAC2XXXX", // for silent or medical trigger
            "AMAXsensor_Alt_ID": 1,
            "AMAXsensor_AltState": 0,
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
    let target_state=null,
        current_state=null,
        alt_trigger_state=null,
       	Switch_ARM_Topic = "/rcp",
    	Switch_DISARM_Topic = Switch_ARM_Topic,
    	ARMTopic = "/status/input:" + config.AMAXsensor_ARM_ID.toString(),
    	TRIGTopic = "/status/input:" + config.AMAXsensor_TRIG_ID.toString();
   // let AltTopic="/status/input:" + config.AMAXsensor_Alt_ID; uncomment to add AltSensorState
    
    // topics definition 
    if (config.ShellyGen == 1) {
    	Switch_ARM_Topic = config.AMAXswitch_ARM + "/relay/" + config.AMAXswitch_ARM_ID.toString() + "/command";
    	Switch_DISARM_Topic = config.AMAXswitch_DISARM + "/relay/" + config.AMAXswitch_DISARM_ID.toString() + "/command";
    	ARMTopic = "/input/" + config.AMAXsensor_ARM_ID.toString();
    	TRIGTopic = "/input/" + config.AMAXsensor_TRIG_ID.toString();
 //   	AltTopic = "/input/" + config.AMAXsensor_Alt_ID.toString; // uncomment to use it
    }
    

	config.topics = {
		"getCurrentState":config.AMAXsensor_TRIG + TRIGTopic,
        "getTargetState":config.AMAXsensor_ARM + ARMTopic,
        "setTargetState":Switch_ARM_Topic }; // Caution, two methods could exist
    
/* uncomment to add AltSensorState
    if (typeof config.AMAXsensor_Alt != 'undefined' ) {
		config.topics = Object.assign({},config.topics,"getAltSensorState":config.AMAXsensor_Alt + AltTopic);
    }
*/
    
    log(`Starting Bosh AMAX key switch Codec for ${config.name} with sensors:
    	ARMED : ${config.AMAXsensor_ARM + ARMTopic}
    	TRIGGERING : ${config.AMAXsensor_TRIG + TRIGTopic}
    	and controls :
    	ARM ${Switch_ARM_Topic}
    	DISARM ${Switch_DISARM_Topic}`);    

    function decodeAMAX( message, info, output ) { 
    	log(`decoding + [${info.property}] with message [${message}]`);
    	let msg = JSON.parse(message).state;
        if (config.ShellyGen == 1) {
       		msg = message;
        }
    
        if (info.property == "targetState") {
            //getTargetState return targetState
            if (msg == 0) {
            	target_state = "AA";
				notify(config.targetState,1);        	
            }
            else {
            	target_state = "D";
          		notify(config.targetState,3);
            }
            output(target_state);
        }

        // in this case we use getCurrentState to probe triggered state
        if (info.property == "currentState") {
       		if (msg == config.AMAXsensor_TriggeredState || alt_trigger_state == true ) {
				current_state = "T"; current_state_id = 4;	
            	log(`Notifying currentState = ${current_state_id}`);
          		notify(config.currentState,current_state_id);        	
            }
            else {
            	current_state = target_state ;
          //		notify(config.currentState,3);        	
            }
			output(current_state);
		}

/* uncomment to add AltSensorState
// Here we use an alternate sensor to probe triggered state (like medical or silent trigger)
        if (info.property == "getAltSensorState") {
            if (msg == config.AMAXsensor_AltState) {
            	alt_trigger_state = true;
            	log("Alternative Trigger detected , notifying !!!");
            	notify(config.currentState,4);        	
            }
            else {
            	alt_trigger_state = false;
            	log("Trigger not detected, nothing to do");     	
            	}
			return alt_trigger_state;
		}

*/
/** TODO
        if (info.property == "statusTampered") {

		}
**/
	}

	function encodeAMAX(message, info, output) {
    	log(`encoding + [${info.property}] with message [${message}]`);
        if (info.property == "targetState") {
        	if (message == target_state ) { return undefined;} // RAS l'info est déja passée
        	if (message == "AA" || message == "D") {
        		// si nécessaire on publie le changement d'état
        		if (message == "AA") {
        			State = true; Switch = Switch_ARM_Topic;
        			Switch_ID = config.AMAXswitch_ARM_ID;
        			notify(config.target_state,1);
        			notify(config.current_state,1);
        		}
        		else {
        			State = false; Switch = Switch_DISARM_Topic;
        			Switch_ID = config.AMAXswitch_DISARM_ID;
        			notify(config.target_state,3);
        			notify(config.current_state,3);
        		}
				// on enregistre la requête
				target_state = message;
				// et on envoie un pulse unique
				if (config.ShellyGen == 1) {
					publish(Switch, "on");
	//				publish(Switch, false);
				}
				else {
        			publish(Switch, JSON.stringify({id: 123, src: 'user_1',
        				method: 'Switch.Set', params: {id: Switch_ID, on: true}}));
  //      			setTimeout(publish(Switch, JSON.stringify({id: 123, src: 'user_1',
  //      				method: 'Switch.Set', params: {id: Switch_ID, on: false}})),100);
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
