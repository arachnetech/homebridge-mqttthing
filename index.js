// MQTT Thing Accessory plugin for Homebridge
// A Homebridge plugin for serveral services, based on homebrige-mqtt-switch and homebridge-mqttlightbulb

'use strict';

var Service, Characteristic;
var mqtt = require("mqtt");

function makeThing(log, config) {

    // MQTT message dispatch
    var mqttDispatch = {}; // map of topic to function( topic, message ) to handle

    var logmqtt = config.logMqtt;

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
            username: config.username,
            password: config.password,
            rejectUnauthorized: false
        };

        var mqttClient = mqtt.connect(config.url, options);
        mqttClient.on('error', function (err) {
            log('MQTT Error: ' + err);
        });

        mqttClient.on('message', function (topic, message) {
            if (logmqtt) {
                log("Received MQTT: " + topic + " = " + message);
            }
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
        if( logmqtt ) {
            log( 'Publishing MQTT: ' + topic + ' = ' + message );
        }
        mqttClient.publish(topic, message.toString());
    }

    var c_mySetContext = '---my-set-context--';

    // The states of our characteristics
    var state = {};

    function onOffValue(value) {
        var pubVal = (value ? config.onValue : config.offValue);
        if (pubVal === undefined) {
            if (config.integerValue) {
                pubVal = value ? 1 : 0;
            } else {
                pubVal = value ? true : false;
            }
        }
        return pubVal.toString();
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

    function addCharacteristic( service, property, characteristic, defaultValue, characteristicChanged ) {

        state[ property ] = defaultValue;

        var charac = service.getCharacteristic( characteristic );

        charac.setValue( defaultValue, undefined, c_mySetContext );

        charac.on( 'get', function( callback ) {
            //log( 'read ' + property );
            callback( null, state[ property ] );
        } );

        if( characteristicChanged ) {
            charac.on( 'set', function( value, callback, context ) {
                if( context !== c_mySetContext ) {
                    //log( 'set ' + property + ' to ' + value );
                    state[ property ] = value;
                    characteristicChanged();
                }
                callback();
            } );
        }
    }

    function characteristics_HSVLight( service ) {

        function publish() {
            var bri = state.bri;
            if( ! config.topics.setOn ) {
                if( state.on ) {
                    if( bri == 0 ) {
                        bri = 100;
                    }
                } else {
                    bri = 0;
                }
            }
            var msg = state.hue + ',' + state.sat + ',' + bri;
            mqttPublish( config.topics.setHSV, msg );
        }

        if( config.topics.setOn ) {
            characteristic_On( service );
        } else {
            addCharacteristic( service, 'on', Characteristic.On, 0, publish );
        }
        addCharacteristic( service, 'hue', Characteristic.Hue, 0, publish );
        addCharacteristic( service, 'sat', Characteristic.Saturation, 0, publish );
        addCharacteristic( service, 'bri', Characteristic.Brightness, 100, publish );

        if( config.topics.getHSV ) {
            mqttSubscribe( config.topics.getHSV, function( topic, message ) {
                var comps =  ('' + message ).split( ',' );
                if( comps.length == 3 ) {
                    var hue = parseInt( comps[ 0 ] );
                    var sat = parseInt( comps[ 1 ] );
                    var bri = parseInt( comps[ 2 ] );

                    if( ! config.topics.setOn ) {
                        var on = bri > 0 ? 1 : 0;

                        if( on != state.on ) {
                            state.on = on;
                            //log( 'on ' + on );
                            service.getCharacteristic( Characteristic.On ).setValue( on, undefined, c_mySetContext );
                        }
                    }

                    if( hue != state.hue ) {
                        state.hue = hue;
                        //log( 'hue ' + hue );
                        service.getCharacteristic( Characteristic.Hue ).setValue( hue, undefined, c_mySetContext );
                    }

                    if( sat != state.sat ) {
                        state.sat = sat;
                        //log( 'sat ' + sat );
                        service.getCharacteristic( Characteristic.Saturation ).setValue( sat, undefined, c_mySetContext );
                    }

                    if( bri != state.bri ) {
                        state.bri = bri;
                        //log( 'bri ' + bri );
                        service.getCharacteristic( Characteristic.Brightness ).setValue( bri, undefined, c_mySetContext );
                    }
                }
            } );
        }
    }

    /* 
     * HSV to RGB conversion from https://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately
     * accepts parameters
     * h  Object = {h:x, s:y, v:z}
     * OR 
     * h, s, v
     */
    function HSVtoRGB(h, s, v) {
        var r, g, b, i, f, p, q, t;
        if (arguments.length === 1) {
            s = h.s, v = h.v, h = h.h;
        }
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    function ScaledHSVtoRGB( h, s, v ) {
        return HSVtoRGB( h / 360, s / 100, v / 100 );
    }

    /* accepts parameters
     * r  Object = {r:x, g:y, b:z}
     * OR 
     * r, g, b
     */
    function RGBtoHSV(r, g, b) {
        if (arguments.length === 1) {
            g = r.g, b = r.b, r = r.r;
        }
        var max = Math.max(r, g, b), min = Math.min(r, g, b),
            d = max - min,
            h,
            s = (max === 0 ? 0 : d / max),
            v = max / 255;

        switch (max) {
            case min: h = 0; break;
            case r: h = (g - b) + d * (g < b ? 6: 0); h /= 6 * d; break;
            case g: h = (b - r) + d * 2; h /= 6 * d; break;
            case b: h = (r - g) + d * 4; h /= 6 * d; break;
        }

        return {
            h: h,
            s: s,
            v: v
        };
    }

    function RGBtoScaledHSV( r, g, b ) {
        var hsv = RGBtoHSV( r, g, b );
        return { 
            h: hsv.h * 360,
            s: hsv.s * 100,
            v: hsv.v * 100
        };
    }

    function characteristics_RGBLight( service ) {

        function publish() {
            var bri = state.bri;
            if( ! config.topics.setOn ) {
                if( state.on ) {
                    if( bri == 0 ) {
                        bri = 100;
                    }
                } else {
                    bri = 0;
                }
            }
            var rgb = ScaledHSVtoRGB( state.hue, state.sat, bri );
            var msg = rgb.r + ',' + rgb.g + ',' + rgb.b;
            mqttPublish( config.topics.setRGB, msg );
        }

        if( config.topics.setOn ) {
            characteristic_On( service );
        } else {
            addCharacteristic( service, 'on', Characteristic.On, 0, publish );
        }
        addCharacteristic( service, 'hue', Characteristic.Hue, 0, publish );
        addCharacteristic( service, 'sat', Characteristic.Saturation, 0, publish );
        addCharacteristic( service, 'bri', Characteristic.Brightness, 100, publish );

        if( config.topics.getRGB ) {
            mqttSubscribe( config.topics.getRGB, function( topic, message ) {
                var comps =  ('' + message ).split( ',' );
                if( comps.length == 3 ) {
                    var red = parseInt( comps[ 0 ] );
                    var green = parseInt( comps[ 1 ] );
                    var blue = parseInt( comps[ 2 ] );

                    var hsv = RGBtoScaledHSV( red, green, blue );
                    var hue = hsv.h;
                    var sat = hsv.s;
                    var bri = hsv.b;

                    if( ! config.topics.setOn ) {
                        var on = bri > 0 ? 1 : 0;

                        if( on != state.on ) {
                            state.on = on;
                            //log( 'on ' + on );
                            service.getCharacteristic( Characteristic.On ).setValue( on, undefined, c_mySetContext );
                        }
                    }

                    if( hue != state.hue ) {
                        state.hue = hue;
                        //log( 'hue ' + hue );
                        service.getCharacteristic( Characteristic.Hue ).setValue( hue, undefined, c_mySetContext );
                    }

                    if( sat != state.sat ) {
                        state.sat = sat;
                        //log( 'sat ' + sat );
                        service.getCharacteristic( Characteristic.Saturation ).setValue( sat, undefined, c_mySetContext );
                    }

                    if( bri != state.bri ) {
                        state.bri = bri;
                        //log( 'bri ' + bri );
                        service.getCharacteristic( Characteristic.Brightness ).setValue( bri, undefined, c_mySetContext );
                    }
                }
            } );
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

    function stringCharacteristic(service, property, characteristic, setTopic, getTopic, initialValue) {
        // default state
        state[property] = initialValue ? initialValue : '';

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
                if (state[property] !== newState) {
                    state[property] = newState;
                    service.getCharacteristic(characteristic).setValue(newState, undefined, c_mySetContext);
                }
            });
        }
    }

    function multiCharacteristic(service, property, characteristic, setTopic, getTopic, values, initialValue, eventOnly) {
        // Values is an array of MQTT values indexed by <value of Homekit enumeration>.
        // Build map of MQTT values to homekit values
        var mqttToHomekit = {};
        for (let i = 0; i < values.length; i++) {
            mqttToHomekit[values[i]] = i;
        }

        state[property] = initialValue;

        var charac = service.getCharacteristic(characteristic);

        // Homekit get
        if (!eventOnly) {
            charac.on('get', function (callback) {
                callback(null, state[property]);
            });
        }

        // Homekit set
        if (setTopic) {
            charac.on('set', function (value, callback, context) {
                if (context !== c_mySetContext) {
                    state[property] = value;
                    let mqttVal = values[value];
                    if (mqttVal !== undefined) {
                        mqttPublish(setTopic, mqttVal);
                    }
                    callback();
                }
            });
        }

        if (initialValue) {
            charac.setValue(initialValue, undefined, c_mySetContext);
        }

        // MQTT set (Homekit get)
        if (getTopic) {
            mqttSubscribe(getTopic, function (topic, message) {
                let data = message.toString();
                let newState = mqttToHomekit[data];
                if (newState !== undefined && ( eventOnly || state[property] != newState ) ) {
                    if( logmqtt ) {
                        log( 'State is now: ' + newState );
                    }
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
        stringCharacteristic(service, 'name', Characteristic.Name, null, config.topics.getName, config.name);
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
        booleanCharacteristic(service, 'occupancyDetected', Characteristic.OccupancyDetected, null, config.topics.getOccupancyDetected, false, function (val) {
            return val ? Characteristic.OccupancyDetected.OCCUPANCY_DETECTED : Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;
        });
    }

    // Characteristic.CurrentAmbientLightLevel
    function characteristic_CurrentAmbientLightLevel(service) {
        floatCharacteristic(service, 'currentAmbientLightLevel', Characteristic.CurrentAmbientLightLevel,
            null, config.topics.getCurrentAmbientLightLevel, 0.0001);
    }

    // Characteristic.CurrentTemperature
    function characteristic_CurrentTemperature(service) {
        floatCharacteristic(service, 'currentTemperature', Characteristic.CurrentTemperature,
            null, config.topics.getCurrentTemperature, 0 );
    }

    // Characteristic.CurrentRelativeHumidity
    function characteristic_CurrentRelativeHumidity(service) {
        floatCharacteristic(service, 'currentRelativeHumidity', Characteristic.CurrentRelativeHumidity,
            null, config.topics.getCurrentRelativeHumidity, 0 );
    }

    // Characteristic.ContactSensorState
    function characteristic_ContactSensorState(service) {
        booleanCharacteristic(service, 'contactSensor', Characteristic.ContactSensorState,
            null, config.topics.getContactSensorState, false, function (val) {
                return val ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED;
            });
    }

    // Characteristic.ProgrammableSwitchEvent
    function characteristic_ProgrammableSwitchEvent(service) {
        let values = config.switchValues;
        if (!values) {
            values = ['1', '2', 'L']; // 1 means SINGLE_PRESS, 2 means DOUBLE_PRESS, L means LONG_PRESS
        }
        multiCharacteristic(service, 'progswitch', Characteristic.ProgrammableSwitchEvent, null, config.topics.getSwitch, values, null, true);
    }

    // Characteristic.Volume
    function characteristic_Volume(service) {
        floatCharacteristic(service, 'volume', Characteristic.Volume, config.topics.setVolume, config.topics.getVolume, 0);
    }

    // Characteristic.SecuritySystemCurrentState
    function characteristic_SecuritySystemCurrentState(service) {
        let values = config.currentStateValues;
        if (!values) {
            values = ['SA', 'AA', 'NA', 'D', 'T'];
        }
        multiCharacteristic(service, 'seccur', Characteristic.SecuritySystemCurrentState, null, config.topics.getCurrentState, values, Characteristic.SecuritySystemCurrentState.DISARMED);
    }

    // Characteristic.SecuritySystemTargetState
    function characteristic_SecuritySystemTargetState(service) {
        let values = config.targetStateValues;
        if (!values) {
            values = ['SA', 'AA', 'NA', 'D'];
        }
        multiCharacteristic(service, 'sectar', Characteristic.SecuritySystemTargetState, config.topics.setTargetState, config.topics.getTargetState, values, Characteristic.SecuritySystemTargetState.DISARM);
    }

    // Characteristic.SmokeDetected
    function characteristic_SmokeDetected(service) {
        booleanCharacteristic(service, 'smokeDetected', Characteristic.SmokeDetected,
            null, config.topics.getSmokeDetected, false, function (val) {
                return val ? Characteristic.SmokeDetected.SMOKE_DETECTED : Characteristic.SmokeDetected.SMOKE_NOT_DETECTED;
            });
    }
    
    // Characteristic.CurrentDoorState
    function characteristic_CurrentDoorState(service) {
        let values = config.doorValues;
        if (!values) {
            values = ['O', 'C', 'o', 'c', 'S'];
        }
        multiCharacteristic(service, 'doorcur', Characteristic.CurrentDoorState, null, config.topics.getCurrentDoorState, values, Characteristic.CurrentDoorState.OPEN);
    }

    // Characteristic.TargetDoorState
    function characteristic_TargetDoorState(service) {
        let values = config.doorValues;
        if (!values) {
            values = ['O', 'C'];
        }
        multiCharacteristic(service, 'doortar', Characteristic.TargetDoorState, config.topics.setTargetDoorState, config.topics.getTargetDoorState, values, Characteristic.TargetDoorState.OPEN);
    }

    // Characteristic.ObstructionDetected
    function characteristic_ObstructionDetected(service) {
        booleanCharacteristic(service, 'obstrucdet', Characteristic.ObstructionDetected, null, config.topics.getObstructionDetected, false);
    }
    
    // Characteristic.LockCurrentState
    function characteristic_LockCurrentState(service) {
        let values = config.lockValues;
        if( ! values ) {
            values = [ 'U', 'S', 'J', '?' ];
        }
        multiCharacteristic( service, 'lockcur', Characteristic.LockCurrentState, null, config.topics.getLockCurrentState, values, Characteristic.LockCurrentState.UNSECURED );
    }

    // Characteristic.LockTargetState
    function characteristic_LockTargetState(service) {
        let values = config.lockValues;
        if( ! values ) {
            values = [ 'U', 'S' ];
        }
        multiCharacteristic( service, 'locktar', Characteristic.LockTargetState, config.topics.setLockTargetState, config.topics.getLockTargetState, values, Characteristic.LockTargetState.UNSECURED );
    }

    
    // Create service
    function createServices() {

        var name = config.name;
        var addSensorOptionalProps = false;

        var service = null; // to return a single service
        var services = null; // if returning multiple services

        if (config.type == "lightbulb") {
            service = new Service.Lightbulb(name);
            if( config.topics.setHSV ) {
                characteristics_HSVLight(service);
            } else if( config.topics.setRGB ) {
                characteristics_RGBLight(service);
            } else {
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
        } else if (config.type == "temperatureSensor") {
            service = new Service.TemperatureSensor(name);
            characteristic_CurrentTemperature(service);
            addSensorOptionalProps = true;
        } else if (config.type == "humiditySensor") {
            service = new Service.HumiditySensor(name);
            characteristic_CurrentRelativeHumidity(service);
            addSensorOptionalProps = true;
        } else if (config.type == "contactSensor") {
            service = new Service.ContactSensor(name);
            characteristic_ContactSensorState(service);
            addSensorOptionalProps = true;
        } else if (config.type == "doorbell") {
            service = new Service.Doorbell(name);
            characteristic_ProgrammableSwitchEvent(service);
            if (config.topics.setBrightness || config.topics.getBrightness) {
                characteristic_Brightness(service);
            }
            if (config.topics.setVolume || config.topics.getVolume) {
                characteristic_Volume(service);
            }
            services = [service];
            if( config.topics.getMotionDetected ) {
                // also create motion sensor
                let motionsvc = new Service.MotionSensor(name + '-motion' );
                characteristic_MotionDetected(motionsvc);
                // return motion sensor too
                services.push( motionsvc );
            }
        } else if( config.type == "statelessProgrammableSwitch" ) {
            service = new Service.StatelessProgrammableSwitch( name );
            characteristic_ProgrammableSwitchEvent(service);
        } else if (config.type == "securitySystem") {
            service = new Service.SecuritySystem(name);
            characteristic_SecuritySystemCurrentState(service);
            characteristic_SecuritySystemTargetState(service);
            if (config.topics.getStatusFault) {
                characteristic_StatusFault(service);
            }
            if (config.topics.getStatusTampered) {
                characteristic_StatusTampered(service);
            }
            // todo: SecuritySystemAlarmType
        } else if (config.type == "smokeSensor") {
            service = new Service.SmokeSensor(name);
            characteristic_SmokeDetected(service);
            addSensorOptionalProps = true;
        } else if( config.type == "garageDoorOpener" ) {
            service = new Service.GarageDoorOpener(name);
            characteristic_CurrentDoorState(service);
            characteristic_TargetDoorState(service);
            characteristic_ObstructionDetected(service);
            if( config.topics.getLockCurrentState ) {
                characteristic_LockCurrentState(service);
            }
            if( config.topics.setLockTargetState ) {
                characteristic_LockTargetState(service);
            }
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

        if( services ) {
            return services;
        } else if( service ) {
            return [ service ];
        } else {
            log( 'Error: No service(s) returned for ' + name );
        }
    }

    // The service
    var services = createServices();

    // Our accessory instance
    var thing = {};

    // Return services
    thing.getServices = function () {
        return services;
    };

    return thing;
}

// Homebridge Entry point
module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory("homebridge-mqttthing", "mqttthing", makeThing);
}
