/**
A codec to use Shellies Gen1 or Gen2 switch and sensors to control a Bosh AMAX securitySystem

Place this file alongside your
config.json file, and add the following simple config:
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
        trigger_state=null,
       	Switch_ARM_Topic = "/rcp",
    	Switch_DISARM_Topic = Switch_ARM_Topic ;
    
    // Topics settings, could be better coded inside the let declaration
    if (config.ShellyGen == 1) {
    	Switch_ARM_Topic = config.AMAXswitch_ARM + "/relay/" + config.AMAXswitch_ARM_ID.toString() + "/command";
    	Switch_DISARM_Topic = config.AMAXswitch_DISARM + "/relay/" + config.AMAXswitch_DISARM_ID.toString() + "/command";
    }
    
    let ARMTopic = "/input/" + config.AMAXsensor_ARM_ID.toString(),
    	TRIGTopic = "/input/" + config.AMAXsensor_TRIG_ID.toString();

	config.topics = {
	"getCurrentState":config.AMAXsensor_ARM + ARMTopic,
        "getTargetState":config.AMAXsensor_ARM + ARMTopic,
        "setTargetState":Switch_ARM_Topic, // Caution, two methods could exist, this only set one
        "getAltSensorState":config.AMAXsensor_TRIG + TRIGTopic // change "getAltSensorState" to "getFaultState" if you use mqtthing 1.32
    };
    
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
		notify(config.targetState,1); // not sure it works, i may not undestand well this function	
            }
            else {
            	target_state = "D";
          	notify(config.targetState,3); // but if it works, that's a cool way to speed up things
            }
            output(target_state);
        }
            
        if (info.property == "currentState") {
            if (msg == config.AMAXsensor_ARMEDState) {
            	if (trigger_state === true ) {current_state = "T"; current_state_id = 4;}
            	else {current_state = "AA"; current_state_id = 1;}	
            	log(`Notifying currentState = ${current_state_id}`);
          	notify(config.currentState,current_state_id);	
            }
            else {
            	current_state = "D";
          	notify(config.currentState,3);
            }
		output(current_state);
	}
	    
//	Here we use the AltSensorState, if the topic is not available you could use the Tampered/FaultState instead
        if (info.property == "getAltSensorState") {
            if (msg == config.AMAXsensor_TriggeredState && current_state == "AA") {
            	trigger_state = true;
            	log("Trigger detected , notifying !!!");
            	notify(config.currentState,4);        	
            }
            else {
            	trigger_state = false;
            	log("Trigger not detected, nothing to do");     	
            }
		return trigger_state;
	}

/** Use this one if you use mqtthing 1.32
        if (info.property == "getFaultState") {
            if (msg == config.AMAXsensor_TriggeredState && current_state == "AA") {
            	trigger_state = true;
            	log("Trigger detected , notifying !!!");
            	notify(config.currentState,4);        	
            }
            else {
            	trigger_state = false;
            	log("Trigger not detected, nothing to do");     	
            }
		return trigger_state;
	}
**/
	}

	function encodeAMAX(message, info, output) {
    	log(`encoding + [${info.property}] with message [${message}]`);
        if (info.property == "targetState") {
        	if (message == target_state ) { return undefined;} // nothing to do, things going on
        	if (message == "AA" || message == "D") {
        		// if needed we publish the changing state
        		if (message == "AA") {
        			State = true; Switch = Switch_ARM_Topic;
        			Switch_ID = config.AMAXswitch_ARM_ID;
        			notify(config.target_state,1); // not sure it works
        			notify(config.current_state,1);
        		}
        		else {
        			State = false; Switch = Switch_DISARM_Topic;
        			Switch_ID = config.AMAXswitch_DISARM_ID;
        			notify(config.target_state,3);
        			notify(config.current_state,3);
        		}
				target_state = message;
				// sending a pulse, check you Shelly setting to enable auto-off if needed
				if (config.ShellyGen == 1) {
					publish(Switch, "on");
//					setTimeOut(publish(Switch, false),1000);
				}
				else {
        			publish(Switch, JSON.stringify({id: 123, src: 'user_1',
        				method: 'Switch.Set', params: {id: Switch_ID, on: true}}));
  //      			setTimeout(publish(Switch, JSON.stringify({id: 123, src: 'user_1',
  //      				method: 'Switch.Set', params: {id: Switch_ID, on: false}})),1000);
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
