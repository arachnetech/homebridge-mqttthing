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

    function booleanCharacteristic(service, property, characteristic, setTopic, getTopic) {
        // default state
        state[property] = false;

        // set up characteristic
        service.getCharacteristic(characteristic)
            .on('get', function (callback) {
                callback(null, state[property]);
            }).on('set', function (value, callback, context) {
                if (context !== c_mySetContext) {
                    state[property] = value;
                    mqttPublish(setTopic, onOffValue(value));
                }
                callback();
            });

        // subscribe to get topic
        if (getTopic) {
            mqttSubscribe(getTopic, function (topic, message) {
                var newState = (message == onOffValue(true));
                if (state[property] != newState) {
                    state[property] = newState;
                    service.getCharacteristic(characteristic).setValue(newState, undefined, c_mySetContext);
                }
            });
        }
    }

    function integerCharacteristic(service, property, characteristic, setTopic, getTopic) {
        // default state
        state[property] = 0;

        // set up characteristic
        service.getCharacteristic(characteristic)
            .on('get', function (callback) {
                callback(null, state[property]);
            }).on('set', function (value, callback, context) {
                if (context !== c_mySetContext) {
                    state[property] = value;
                    mqttPublish(setTopic, value);
                }
                callback();
            });

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

    // Create service
    function createService() {

        var name = config.name;

        var service;

        if (config.type == "lightbulb") {
            service = new Service.Lightbulb(name);
            characteristic_On(service);
            if (config.topics.setBrightness) {
                characteristic_Brightness(service);
            }
            if( config.topics.setHue) {
                characteristic_Hue(service);
            }
            if( config.topics.setSaturation) {
                characteristic_Saturation(service);
            }
        } else if( config.type == "switch" ) {
            service = new Service.Switch( name );
            characteristic_On(service);
        } else {
            log("ERROR: Unrecognized type: " + config.type);
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
