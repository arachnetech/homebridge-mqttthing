// MQTT Thing Accessory plugin for Homebridge
// A Homebridge plugin for a simple simple services, based on homebrige-mqtt-switch and homebridge-mqttlightbulb

'use strict';

var Service, Characteristic;
var mqtt = require("mqtt");

function makeThing(log, config) {

    // MQTT message dispatch
    var mqttDispatch = {}; // map of topic to function( topic, message ) to handle

    function mqttInit() {
        var clientId = 'mqttthing_' + config.name + '_' + Math.random().toString(16).substr(2, 8);
        var options = {
            keepalive: 10,
            clientId: clientId,
            protocolId: 'MQTT',
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000,
            will: {
                topic: 'WillMsg',
                payload: 'Connection Closed abnormally..!',
                qos: 0,
                retain: false
            },
            username: config["username"],
            password: config["password"],
            rejectUnauthorized: false
        };

        var mqttClient = mqtt.connect(config.url, options);
        mqttClient.on('error', function (err) {
            log('MQTT Error: ' + err);
        });

        mqttClient.on('message', function (topic, message) {
            //log("Received MQTT: " + topic + " = " + message);
            var handler = mqttDispatch[topic];
            if (handler) {
                handler(topic, message);
            } else {
                log('Warning: No MQTT dispatch handler for topic [' + topic + ']');
            }
        });

        return mqttClient;
    }

    // Initialize MQTT client
    var mqttClient = mqttInit();

    function mqttSubscribe(topic, handler) {
        mqttDispatch[topic] = handler;
        mqttClient.subscribe(topic);
    }

    function mqttPublish(topic, message) {
        mqttClient.publish(topic, message.toString());
    }

    var c_mySetContext = '---my-set-context--';

    // The states of our characteristics
    var state = {};

    function onOffValue(value) {
        var pubVal = (value ? config.onValue : config.offValue);
        if (pubVal == null) {
            if (config.integerValue) {
                pubVal = value ? 1 : 0;
            } else {
                pubVal = value ? true : false;
            }
        }
        return pubVal;
    }

    function mapValueForHomebridge(val, mapValueFunc) {
        if (mapValueFunc) {
            return mapValueFunc(val);
        } else {
            return val;
        }
    }

    function booleanCharacteristic(service, property, characteristic, setTopic, getTopic, initialValue, mapValueFunc) {
        // default state
        state[property] = (initialValue ? true : false);

        // set up characteristic
        var charac = service.getCharacteristic(characteristic);
        charac.on('get', function (callback) {
            //log('read ' + property + ' as ' + state[property]);
            callback(null, state[property]);
        });
        if (setTopic) {
            charac.on('set', function (value, callback, context) {
                if (context !== c_mySetContext) {
                    state[property] = value;
                    mqttPublish(setTopic, onOffValue(value));
                }
                callback();
            });
        }
        if (initialValue) {
            charac.setValue(mapValueForHomebridge(initialValue, mapValueFunc), undefined, c_mySetContext);
        }

        // subscribe to get topic
        if (getTopic) {
            mqttSubscribe(getTopic, function (topic, message) {
                var newState = (message == onOffValue(true));
                if (state[property] != newState) {
                    state[property] = newState;
                    service.getCharacteristic(characteristic).setValue(mapValueForHomebridge(newState, mapValueFunc), undefined, c_mySetContext);
                }
            });
        }
    }

    function integerCharacteristic(service, property, characteristic, setTopic, getTopic) {
        // default state
        state[property] = 0;

        // set up characteristic
        var charac = service.getCharacteristic(characteristic);
        charac.on('get', function (callback) {
            callback(null, state[property]);
        });
        if (setTopic) {
            charac.on('set', function (value, callback, context) {
                if (context !== c_mySetContext) {
                    state[property] = value;
                    mqttPublish(setTopic, value);
                }
                callback();
            });
        }

        // subscribe to get topic
        if (getTopic) {
            mqttSubscribe(getTopic, function (topic, message) {
                var newState = parseInt(message);
                if (state[property] != newState) {
                    state[property] = newState;
                    service.getCharacteristic(characteristic).setValue(newState, undefined, c_mySetContext);
                }
            });
        }
    }

    function floatCharacteristic(service, property, characteristic, setTopic, getTopic, initialValue) {
        // default state
        state[property] = initialValue;

        // set up characteristic
        var charac = service.getCharacteristic(characteristic);
        charac.on('get', function (callback) {
            callback(null, state[property]);
        });
        if (setTopic) {
            charac.on('set', function (value, callback, context) {
                if (context !== c_mySetContext) {
                    state[property] = value;
                    mqttPublish(setTopic, value);
                }
                callback();
            });
        }
        if (initialValue) {
            charac.setValue(initialValue, undefined, c_mySetContext);
        }

        // subscribe to get topic
        if (getTopic) {
            mqttSubscribe(getTopic, function (topic, message) {
                var newState = parseFloat(message);
                if (state[property] != newState) {
                    state[property] = newState;
                    service.getCharacteristic(characteristic).setValue(newState, undefined, c_mySetContext);
                }
            });
        }
    }

    function stringCharacteristic(service, property, characteristic, setTopic, getTopic) {
        // default state
        state[property] = config.name ? config.name : '';

        // set up characteristic
        var charac = service.getCharacteristic(characteristic);
        charac.on('get', function (callback) {
            callback(null, state[property]);
        });
        if (setTopic) {
            charac.on('set', function (value, callback, context) {
                if (context !== c_mySetContext) {
                    state[property] = value;
                    mqttPublish(setTopic, value);
                }
                callback();
            });
        }

        // subscribe to get topic
        if (getTopic) {
            mqttSubscribe(getTopic, function (topic, message) {
                var newState = message.toString();
                if (state[property] != newState) {
                    state[property] = newState;
                    service.getCharacteristic(characteristic).setValue(newState, undefined, c_mySetContext);
                }
            });
        }
    }

    // Characteristic.On
    function characteristic_On(service) {
        booleanCharacteristic(service, 'on', Characteristic.On, config.topics.setOn, config.topics.getOn);
    }

    // Characteristic.Brightness
    function characteristic_Brightness(service) {
        integerCharacteristic(service, 'brightness', Characteristic.Brightness, config.topics.setBrightness, config.topics.getBrightness);
    }

    // Characteristic.Hue
    function characteristic_Hue(service) {
        integerCharacteristic(service, 'hue', Characteristic.Hue, config.topics.setHue, config.topics.getHue);
    }

    // Characteristic.Saturation
    function characteristic_Saturation(service) {
        integerCharacteristic(service, 'saturation', Characteristic.Saturation, config.topics.setSaturation, config.topics.getSaturation);
    }

    // Characteristic.OutletInUse
    function characteristic_OutletInUse(service) {
        booleanCharacteristic(service, 'inUse', Characteristic.OutletInUse, null, config.topics.getInUse);
    }

    // Characteristic.Name
    function characteristic_Name(service) {
        stringCharacteristic(service, 'name', Characteristic.Name, null, config.topics.getName);
    }

    // Characteristic.MotionDetected
    function characteristic_MotionDetected(service) {
        booleanCharacteristic(service, 'motionDetected', Characteristic.MotionDetected, null, config.topics.getMotionDetected);
    }

    // Characteristic.StatusActive
    function characteristic_StatusActive(service) {
        booleanCharacteristic(service, 'statusActive', Characteristic.StatusActive, null, config.topics.getStatusActive, true);
    }

    // Characteristic.StatusFault
    function characteristic_StatusFault(service) {
        booleanCharacteristic(service, 'statusFault', Characteristic.StatusFault, null, config.topics.getStatusFault);
    }

    // Characteristic.StatusTampered
    function characteristic_StatusTampered(service) {
        booleanCharacteristic(service, 'statusTampered', Characteristic.StatusTampered, null, config.topics.getStatusTampered);
    }

    // Characteristic.StatusLowBattery
    function characteristic_StatusLowBattery(service) {
        booleanCharacteristic(service, 'statusLowBattery', Characteristic.StatusLowBattery, null, config.topics.getStatusLowBattery);
    }

    // Characteristic.OccupancyDetected
    function characteristic_OccupancyDetected(service) {
        booleanCharacteristic(service, 'occupancyDetected', Characteristic.OccupancyDetected, null, config.topics.getOccupancyDetected);
    }

    // Characteristic.CurrentAmbientLightLevel
    function characteristic_CurrentAmbientLightLevel(service) {
        floatCharacteristic(service, 'currentAmbientLightLevel', Characteristic.CurrentAmbientLightLevel,
            null, config.topics.getCurrentAmbientLightLevel, 0.0001);
    }

    // Characteristic.ContactSensorState
    function characteristic_ContactSensorState(service) {
        booleanCharacteristic(service, 'contactSensor', Characteristic.ContactSensorState,
            null, config.topics.getContactSensorState, false, function (val) {
                return val ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED;
            });
    }

    // Create service
    function createService() {

        var name = config.name;
        var addSensorOptionalProps = false;

        var service;

        if (config.type == "lightbulb") {
            service = new Service.Lightbulb(name);
            characteristic_On(service);
            if (config.topics.setBrightness) {
                characteristic_Brightness(service);
            }
            if (config.topics.setHue) {
                characteristic_Hue(service);
            }
            if (config.topics.setSaturation) {
                characteristic_Saturation(service);
            }
        } else if (config.type == "switch") {
            service = new Service.Switch(name);
            characteristic_On(service);
        } else if (config.type == "outlet") {
            service = new Service.Outlet(name);
            characteristic_On(service);
            if (config.topics.getInUse) {
                characteristic_OutletInUse(service);
            }
        } else if (config.type == "motionSensor") {
            service = new Service.MotionSensor(name);
            characteristic_MotionDetected(service);
            addSensorOptionalProps = true;
        } else if (config.type == "occupancySensor") {
            service = new Service.OccupancySensor(name);
            characteristic_OccupancyDetected(service);
            addSensorOptionalProps = true;
        } else if (config.type == "lightSensor") {
            service = new Service.LightSensor(name);
            characteristic_CurrentAmbientLightLevel(service);
            addSensorOptionalProps = true;
        } else if (config.type == "contactSensor") {
            service = new Service.ContactSensor(name);
            characteristic_ContactSensorState(service);
            addSensorOptionalProps = true;
        } else {
            log("ERROR: Unrecognized type: " + config.type);
        }

        if (addSensorOptionalProps) {
            if (config.topics.getStatusActive) {
                characteristic_StatusActive(service);
            }
            if (config.topics.getStatusFault) {
                characteristic_StatusFault(service);
            }
            if (config.topics.getStatusTampered) {
                characteristic_StatusTampered(service);
            }
            if (config.topics.getStatusLowBattery) {
                characteristic_StatusLowBattery(service);
            }
        }

        if (service) {
            if (config.topics.getName) {
                characteristic_Name(service);
            }
        }

        return service;
    }

    // The service
    var service = createService();

    // Our accessory instance
    var thing = {};

    // Return services
    thing.getServices = function () {
        if (service) {
            return [service];
        }
    };

    return thing;
}

// Homebridge Entry point
module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-mqttthing", "mqttthing", makeThing);
}
