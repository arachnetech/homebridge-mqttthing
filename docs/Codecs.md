[![npm](https://badgen.net/npm/v/homebridge-mqttthing/latest)](https://www.npmjs.com/package/homebridge-mqttthing)
[![npm](https://badgen.net/npm/dt/homebridge-mqttthing)](https://www.npmjs.com/package/homebridge-mqttthing)
[![Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.gg/MTpeMC)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

# Homebridge MQTT-Thing: Codecs

## Introduction

A codec can be used to apply transformations to incoming and outgoing data. Unlike apply functions, a codec is written
in a separate JavaScript file which is referenced by the configuration.

To use a codec, configure the path to its JavaScript file using the `codec` configuration setting. The codec will then be called to encode data before
publishing and to decode received data for all configured topics. The codec can decide which topics and properties to process, and can suppress messages
and generate additional messages as required.

   * [Structure](#structure)
   * [Function Reference](#function-reference)
   * [Properties](#properties)
   * [Example Codecs](#examples)
   * [Built-in Codecs](#built-in-codecs)
      * [JSON Codec](#json-codec-json)

## Structure

A codec is a Node.js module which makes encode() and decode() functions available, which are called for
all properties or specific properties of the configured accessory. Codecs must implement a single function, `init()`, exported through `module.exports`. For example, here is a minimal codec implementation which does nothing:

```javascript
function init() {

    function encode( message ) {
        return message; // no-op
    }

    function decode( message ) {
        return message; // no-op
    }

    // return encode and decode functions
    return {
        encode,
        decode
    };
}

module.exports = {
    init
};
```

This could also be written more concisely as:

```javascript
module.exports = {
    init: function() {
        return {
            encode( message ) {
                return message;
            },
            decode( message ) {
                return message;
            }
        }
    }
}
```

### Local State

A codec that is used by multiple accessories will only be loaded once, so any accessory-specific state must be stored within the `init()` function. The choice to return `encode()` and `decode()` functions from `init()` (as opposed to exporting them directly) is intended to make this easier.

## Function Reference

### `init( params )`

The `init()` function is passed a single object containing initialisation parameters for the accessory.

   * `params.log` can be used to write to Homebridge's log.
   * `params.config` is the accessory's configuration (as configured in `config.json`). This gives the codec access to the standard configuration settings, and lets it use its own if required.
   * `params.publish` may be used to publish to MQTT directly
   * `params.notify` may be used to send MQTT-Thing a property notification

The `init()` function must return an object containing `encode()` and `decode()` functions (as described below). This can be just single `encode()` and `decode()` functions for all properties as above. More commonly a properties map containing property-specific functions is used, as follows:

```javascript
function init() {
    return {
        properties: {
            targetProp1: {
                encode: encodeFunction1,
                decode: decodeFunction1
            },
            targetProp2: {
                encode: encodeFunction2
            },
        },
        encode: defaultEncodeFunction,
        decode: defaultDecodeFunction
    }
}
```

The allows different encoding/decoding logic for each property. The default `encode()`/`decode()` functions are called for properties for which no property-specific function is defined.

### `encode( message, info, output )`

The `encode()` function is called to encode a message before publishing it to MQTT. It is passed three parameters:

   * `message` is the message to be encoded
   * `info` is an object holding:
      * `info.topic` - the MQTT topic to be published
      * `info.property` - the property associated with the publishing operation
      * `info.service` - the entry from the "services" section of a "custom" accessory
   * `output` is a function which may be called to deliver the encoded value asynchronously

The `encode()` function may either return the encoded message, or it may deliver it asynchronously by passing it as a parameter to the provided `output` function. It if does neither, no value will be published.

### `decode( message, info, output )`

The `decode`() function is called to decode a message received from MQTT before passing it for processing by MQTT-Thing. It takes three parameters:

   * `message` is the message to be decoded
   * `info` is an object holding:
      * `info.topic` - the MQTT topic received
      * `info.property` the property associated with the received message
      * `info.service` - the entry from the "services" section of a "custom" accessory
   * `output` is a function which may be called to deliver the decoded value asynchronously

The `decode()` function may either return the decoded message, or it may deliver it asynchronously by passing it as a parameter to the provided `output` function. If it does neither, no notification will be passed on to MQTT-Thing.

### `publish( topic, message )`

The `publish()` function provided in `init()`'s `params` may be used to publish a message directly to MQTT.

   * `topic` is the MQTT topic to publish
   * `message` is the message to publish to MQTT

The message is published directly to MQTT, ignoring any apply function usually with the topic and not passing through the Codec's `encode()` function.

### `notify( property, message )`

The `notify()` function provided in `init()`'s `params` may be used to notify MQTT-Thing of the new value for a property. This will deliver the notification to all internal subscribers to the property. Note that generally a corresponding MQTT 'get' topic must have been configured in order for internal subscribers to exist.

   * `property` is the MQTT-Thing property to update
   * `message` is the value to be passed to MQTT-Thing

The message is passed directly to MQTT-Thing. It does not pass through any apply function or through the Codec's `decode()` function.

## Properties

This section lists the properties available for each accessory type. All accessories may also support `batteryLevel`, `chargingState` and `statusLowBattery`.

### Air Pressure Sensor

`airPressure`, `statusActive`, `statusFault`, `statusTampered`, `statusLowBattery`

### Air Quality Sensor

`airQuality`, `statusActive`, `statusFault`, `statusTampered`, `statusLowBattery`, `carbonDioxideLevel`, `pm10density`, `pm2_5density`, `ozonedensity`, `nitrogenDioxideDensity`, `sulphurDioxideDensity`, `VOCDensity`, `carbonMonoxideLevel`, `airQualityPPM`, `currentTemperature`, `currentRelativeHumidity`

### Carbon Dioxide Sensor

`carbonDioxideDetected`, `carbonDioxideLevel`, `carbonDioxidePeakLevel`, `statusActive`, `statusFault`, `statusTampered`, `statusLowBattery`

### Contact Sensor

`contactSensorState`, `statusActive`, `statusFault`, `statusTampered`, `statusLowBattery`

### Doorbell

`switch`, `brightness`, `volume`, `motionDetected`

### Fan

`on`, `rotationDirection`, `rotationSpeed`

### Garage door opener

`targetDoorState`, `currentDoorState`, `doorMoving`, `obstructionDetected`, `lockTargetState`, `lockCurrentState`

### Heater Cooler

`active`, `currentHeaterCoolerState`, `targetHeaterCoolerState`, `currentTemperature`, `lockPhysicalControls`, `swingMode`, `coolingThresholdTemperature`, `heatingThresholdTemperature`, `temperatureDisplayUnits`, `rotationSpeed`

### Humidity Sensor

`currentRelativeHumidity`, `statusActive`, `statusFault`, `statusTampered`, `statusLowBattery`

### Leak Sensor

`leakDetected`, `statusActive`, `statusFault`, `statusTampered`, `statusLowBattery`

### Light bulb

`on`, `brightness`, `hue`, `saturation`, `colorTemperature`, `white`, `HSV`, `RGB`, `RGBW`, `RGBWW`

### Light Sensor

`currentAmbientLightLevel`, `statusActive`, `statusFault`, `statusTampered`, `statusLowBattery`

### Lock Mechanism

`lockTargetState`, `lockCurrentState`

### Microphone

`mute`, `volume`

### Motion Sensor

`motionDetected`, `statusActive`, `statusFault`, `statusTampered`, `statusLowBattery`

### Occupancy Sensor

`occupancyDetected`, `statusActive`, `statusFault`, `statusTampered`, `statusLowBattery`

### Outlet

`on`, `outletInUse`, `currentConsumption`, `voltage`, `electricCurrent`, `totalConsumption`

### Security System

`targetState`, `currentState`, `statusFault`, `statusTampered`

### Speaker

`mute`, `volume`

### StatelessProgrammableSwitch

`switch`, `switch0`, `switch1`, `switch2`, ...

### Switch

`on`

### Television

`active`, `input`XX

### Temperature Sensor

`currentTemperature`, `statusActive`, `statusFault`, `statusTampered`, `statusLowBattery`

### Thermostat

`currentHeatingCoolingState`, `targetHeatingCoolingState`, `currentTemperature`, `targetTemperature`, `temperatureDisplayUnits`, `currentRelativeHumidity`, `targetRelativeHumidity`, `coolingThresholdTemperature`, `heatingThresholdTemperature`

### Valve (Sprinkler, Shower, Faucet)

`active`, `inUse`, `setDuration`, `remainingDuration`

### Weather Station

`currentTemperature`, `statusActive`, `statusFault`, `statusTampered`, `statusLowBattery`, `currentRelativeHumidity`, `airPressure`, `weatherCondition`, `rain1h`, `rain24h`, `uvIndex`, `visibility`, `windDirection`, `windSpeed`

### Window

`currentPosition`, `targetPosition`, `positionState`, `holdPosition`, `obstructionDetected`

### Window Covering (Blinds)

`currentPosition`, `targetPosition`, `positionState`, `holdPosition`, `obstructionDetected`, `targetHorizontalTiltAngle`, `currentHorizontalTiltAngle`, `targetVerticalTiltAngle`, `currentVerticalTiltAngle`

## Examples

When writing a codec, you may find it helpful to start with the no-op implementation in [`test/empty-codec.js`](../test/empty-codec.js).

Test examples of codec capabilities can be found in [`test/test-codec.js`](../test/test-codec.js).

### Toggle switch

This codec can be used to toggle the state of a switch whenever it receives any message.

#### Accessory (in *config.json*)

```json
    {
        "accessory": "mqttthing",
        "type": "switch",
        "name": "Toggle Switch",
        "url": "mqtt-url",
        "logMqtt": true,
        "topics": {
            "getOn": "test/toggle/get",
            "setOn": "test/toggle/set"
        },
        "codec": "toggle.js"
    }
```

#### Codec file (*toggle.js*)

```javascript
/**
 * Test 'toggle' codec - toggles switch on receipt of any message
 * toggle.js
 */

'use strict'

module.exports = {
    init: function() {
        let state = false;
        return {
            properties: {
                on: {
                    decode: function() {
                        state = ! state;
                        return state;
                    },
                    encode: function( msg ) {
                        state = msg;
                        return msg;
                    }
                }
            }
        };
    }
};
```

Codec state is declared within _init()_. The codec targets only the **on** property, toggling its state whenever it receives a message and recording the current state when publishing.

### Keep-alive Codec

Codecs can be used to run arbitrary JavaScript code from within MQTT-Thing, not necessarily related to encoding/decoding messages. For example, the codec below sends a 'keep-alive' message at regular intervals. The message and send interval can be configured within the accessory configuration, in `keepAliveMessage` and `keepAliveInterval` respectively.

```javascript
/**
 * Test/Demo Homebridge-MQTTThing Codec (encoder/decoder)
 * Codecs allow custom logic to be applied to accessories in mqttthing, rather like apply() functions, 
 * but in the convenience of a stand-alone JavaScript file.
 * 
 * keep-alive-codec.js - sends keep-alive message at configurable interval
 */

'use strict';

module.exports = {
    init: function( params ) {
        let { config, publish } = params;

        // publish keep-alive topic at regular interval
        if( config.keepAliveTopic ) {
            let keepAlivePeriod = config.keepAlivePeriod || 60;
            let keepAliveMessage = config.keepAliveMessage || '';
    
            setInterval( () => {
                publish( config.keepAliveTopic, keepAliveMessage );
            }, keepAlivePeriod * 1000 );
        }
    
        // no encode/decode in this codec
        return {};
    }
};
```

## Built-in Codecs

Built-in Codecs are provided with MQTT-Thing, and can be referenced without a path or `.js` suffix. For example, to load the JSON Codec, use `"codec": "json"`.

### JSON Codec (json)

The JSON Codec aims to make JSON encoding and decoding, often implemented with _apply()_ functions, easier to configure. If is intended for accessories which encode multiple properties as a JSON object sent over a single topic, instead of sending separate parameters in separate topics.

Mapping to and from JSON is configured using a jsonCodec object in the accessory configuration:

```json
"jsonCodec": {
    "properties": {
        "on": "state.power",
        "RGB": "state.rgb"
    },
    "fixed": { "fixed properties": "object (global/default)" },
    "fixedByTopic": {
        "topic1": { "fixed properties": "object for topic1",
        "topic2": { "fixed properties": "object for topic2" }
    },
    "retain": true|false
}
```

The `jsonCodec` configuration object should contain a `properties` object containing strings indicating the JSON location of each property (as listed in [Properties](#properties), above).

By default, the JSON codec only publishes properties which have updated. To collect all published properties for each published topic, set `"retain": true`.

Fixed values (published with every message) may be specified in a `fixed` object. If multiple topics are published which should have different fixed values, these may be specified through `fixedByTopic`. Fixed values are not required in received messages; only mapped properties are extracted.

For example, the following accessory configuration:

```json
{
    "accessory": "mqttthing",
    "type": "lightbulb",
    "name": "Test RGB Light",
    "url": "http://192.168.10.35:1883",
    "topics": {
        "getRGB": "test/rgblight/get",
        "setRGB": "test/rgblight/set",
        "getOn": "test/rgblight/get",
        "setOn": "test/rgblight/set"
    },
    "logMqtt": true,
    "integerValue": false,
    "codec": "json",
    "jsonCodec": {
        "properties": {
            "on": "state.power",
            "RGB": "state.rgb"
        },
        "fixed": {
            "version": 1,
            "sender": "MQTT-Thing"
        }
    }
}
```

... sends and receives messages like:

`{"version":1,"sender":"MQTT-Thing","state":{"power":true,"rgb":"125,82,255"}}`
