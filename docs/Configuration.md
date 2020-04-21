[![npm](https://badgen.net/npm/v/homebridge-mqttthing/latest)](https://www.npmjs.com/package/homebridge-mqttthing)
[![npm](https://badgen.net/npm/dt/homebridge-mqttthing)](https://www.npmjs.com/package/homebridge-mqttthing)
[![Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.gg/MTpeMC)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

# Homebridge MQTT-Thing: Configuration

## Introduction

Configure the plugin in your homebridge `config.json` file. Most configuration settings can now also be entered using 
[Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x).

MQTT topics used fall into two categories:

   * Control topics, of the form `setXXX`, are published by MQTT-Thing in order to control device state (e.g. to turn on a light).
   * Status/notification topics, of the form `getXXX`, are published by the device to notify MQTT-Thing that something has occurred (e.g. that a sensor has detected something or a control topic action has been performed).

**All values shown below (often within <>) are comments/descriptions, and should not be copied into your configuration file. For an example of an actual configuration file, please see `test/config.json`.**

   * [General Settings](#general-settings)
   * [MQTT Settings](#mqtt-settings)
   * [MQTT Topics](#mqtt-topics)
   * [Topic Apply Functions](#apply-functions)
   * [Boolean Value Settings](#boolean-value-settings)
   * [Accessory Information](#accessory-information)
   * [Publishing Values on Start-up](#publishing-values-on-start-up)
   * [History Service](#history-service)
   * [Confirmation](#confirmation)
   * [Codecs](#codecs)
   * [Accessories](#accessories)

## Common Settings

The following settings apply to all device types:

```javascript
{
    "accessory": "mqttthing",
    "type": "lightbulb",
    "name": "My lightbulb",
    "url": "http://192.168.1.235:1883",
    "username": "MQTT_username",
    "password": "MQTT_password",
    "mqttOptions": { "keepalive": 30 },
    "mqttPubOptions": { "retain": true },
    "logMqtt": true,
    "topics": {
        "getName": 	        "my/get/name/topic",
        "getOnline":        "my/get/online/topic",
        "getBatteryLevel":  "my/get/battery-level/topic",
        "getChargingState": "my/get/battery-charging-state/topic",
        "getStatusLowBattery": "my/get/status-low-battery/topic"
    },
    "integerValue": true,
    "onlineValue": "Online",
    "offlineValue": "Offline",
    "chargingStateValues": [ "NotCharging", "Charging", "NotChargeable" ],
    "startPub": [
        { "topic": "topic1", "message": "message1" },
        { "topic": "topic2", "message": "message2" }
    ],
    "confirmationPeriodms": 1000,
    "retryLimit": 5
}
```

### General Settings

`accessory` - must always be set to the value `mqttthing` in order to use **homebridge-mqttthing**

`type` - one of the supported accessory types listed below

`name` - name of accessory, as displayed in HomeKit

`caption` - HomeKit caption/label (optional)

### MQTT Settings

`url` - URL of MQTT server if not localhost port 1883 (optional)

`username` - Username for MQTT server (optional)

`password` - Password for MQTT server (optional)

`mqttOptions` - Object containing all MQTT options passed to https://www.npmjs.com/package/mqtt#client, for MQTT configuration settings not supported above (optional). Any standard settings *not* specified in an **mqttOptions** option will be set by homebridge-mqttthing. Enable MQTT logging with **logMqtt** to check the options provided.
 
`mqttPubOptions` - Option containing any MQTT publishing options required. See https://www.npmjs.com/package/mqtt#publish for details.

`logMqtt` - Set to true to enable MQTT logging for this accessory (optional, defaults to false)

### MQTT Topics

MQTT Topics are configured within a `topics` object. Most topics are optional (including all of the topics described in this section).

`getName` - Topic that may be published to send HomeKit the name of the accessory (optional). HomeKit doesn't show name changes dynamically, so it's generally simpler just to configure the name with `name`.

`getOnline` - Topic that may be published to tell homebridge-mqttthing whether or not the accessory is online (optional). This is a Boolean value (see below) intended to be published as false by the MQTT Last Will and Testament (LWT) feature in order to notify homebridge-mqttthing that the accessory is offline. Accessories using this feature must also publish an online true status when available.

`getBatteryLevel` - Topic that may be published by an accessory to indicate its current battery level, from 0 to 100 (optional).

`getChargingState` - Topic that may be published by an accessory to indicate its charging state (optional). Default values accepted are `[ "NOT_CHARGING", "CHARGING", "NOT_CHARGEABLE" ]`. These may be changed with the `chargingStateValues` setting.

`getStatusLowBattery` - Topic that may be published by an accessory to indicate whether it has a low battery (optional).

### Apply Functions

User functions may be applied to MQTT messages for custom payload encoding/decoding. Apply functions do this within the main configuration file, but are not supported by config-ui-x. Alternatively, an external codec may be used (see [Codecs](#codecs)).

If an MQTT message is not a simple value or does not match the expected syntax, it is possible to specify a JavaScript function that is called for the message every time it is received/published. For this, the topic string in the configuration can be replaced with an object with these properties:

`topic` - Topic string

`apply` - Javascript function to apply (must be a complete function body that `return`s a value). The function is called with one arguments: `message`, holding the original message, and `state` (optional).

e.g. Decoding a JSON payload:
```javascript
  "topics": {
      "getCurrentTemperature": {
          "topic": "outdoor",
          "apply": "return JSON.parse(message).temperature.toFixed(1);"
      }
  }
```

e.g. Scaling brightness from its internal 0-100 range to an external 0-255 range:
```javascript
    "getBrightness": {
        "topic": "test/lightbulb/getBrightness",
        "apply": "return Math.round( message / 2.55 );"
    },
    "setBrightness": {
        "topic": "test/lightbulb/setBrightness",
        "apply": "return Math.round( message * 2.55 );"
    }
```

The `state` parameter holds an object which may be used to store local state used by the apply function. Additionally, `state.global` points at an object shared between all topics.

This functionality is not currently available when editing MQTT topics using config-ui-x.

### Boolean Value Settings

Homekit Boolean types like on/off use strings "true" and "false" in MQTT messages unless `"integerValue": true` is configured, in which case they use to "1" and "0". Alternatively, specific values can be configured using `onValue` and `offValue` (in which case `integerValue` is ignored). Other Homekit types (integer, string, etc.) are not affected by these settings.

`integerValue` - set to **true** to use the values **1** and **0** to represent Boolean values instead of the strings **"true"** and **"false"** (optional, defaults to false)

`onValue` - configure a specific Boolean true or *on* value (optional)

`offValue` - configure a specific Boolean false or *off* value (optional)

When `onValue` and `offValue` are configured, by default any other value received on the _get_ topic will be ignored. To treat unrecognized received values as off, set `otherValueOff: true`.

`onlineValue`, `offlineValue` - configure specific values representing that an accessory is online or offline (received through `getOnline`). If not specified, the configured *on* and *off* values will be used to represent online and offline states (i.e. `onValue`/`offValue` if configured, otherwise **1** / **0** with `integerValue: true` or **true** / **false** with `integerValue: false`).

In mqttthing versions before 1.0.23, receiving any value not matching the configured 'on value' for a Boolean characteristic turned it off. From 1.0.23, the received message must match the offValue to turn off a characteristic.
To turn off on any value except the onValue, omit configuration of offValue.

From version 1.0.23, mqttthing will not publish a message for a Boolean characteristic turning off if no offValue is configured.

### Accessory Information

The following configuration settings may be specified if required to change information service content:

`manufacturer` - sets the manufacturer name (defaults to *mqttthing*)

`serialNumber` - sets the serial number (defaults to hostname and accessory name)

`model` - sets the model name (defaults to the mqttthing accessory type)

`firmwareRevision` - sets the firmware revision number (defaults to mqttthing version)

### Publishing Values on Start-up

MQTT messages may be published on start-up, e.g. to reset accessories to a known initial state, with `startPub`. This should contain an array of objects with `topic` and `message`
keys, i.e.:
```javascript
"startPub": [
    { "topic": "test/lightbulb/setOn", "message": "1" },
    { "topic": "test/lightbulb/getOn", "message": "1" }
]
```

Previously this was an object containing MQTT topics as keys, and values to be published as values. This format will still work but the format above is preferred.

### History Service

For some accessory types you can enable the History Service powered by [fakegato-history](https://github.com/simont77/fakegato-history). It will show up in the Eve App. (Home.app does not support it).

Depending on the accessory type, fakegato-history may add extra entries every 10 minutes or may average the entries from the plugin and send data every 10 minutes.

History is currently supported for:
* Temperature Sensor
* Humidity Sensor
* Air Pressure Sensor
* Air Quality Sensor
* Motion Sensor
* Contact Sensor
* Outlet (power consumption)
* Switch

`history` - set to **true** for enabling History Service (Boolean, optional)

History options may be specified in a `historyOptions` object containing one or more of the following properties:

`size` - maximum size of stored data points (optional), default: 4032

`noAutoTimer` - enable/disable averaging (and repeating) 10min timer (optional). Set to true to disable auto-timer.

`noAutoRepeat` - enable/disable repetition of last value if no data was received in last 10min interval (optional). Set to true to disable auto-repeat.

`mergeInterval` - set merge interval [minutes] for events, which are very close in time (optional, for motion sensor only, not in combination with autoTimer/autoRepeat), default: 0

`persistencePath` - full path of directory in which to store history data (defaults to homebridge user storage path)

Avoid the use of "/" in characteristics of the Information Service (e.g. serial number, manufacturer, etc.), since this may cause data to not appear in the history. Note that if your Eve.app is controlling more than one accessory for each type, the serial number should be unique, otherwise Eve.app will merge the histories.

### Confirmation

Some accessories support confirmation for some of their 'set' topics. When enabled by configuring `confirmationPeriodms`, the accessory *must* echo anything sent to appropriate `setX` subject(s) to the corresponding `getX` subject(s). Where homebridge-mqttthing doesn't see a confirmation within the configured configuration period (specified in milliseconds), it will publish the set message again. Messages will be republished up to 3 times by default, but this can be changed by also specifying `retryLimit`.

Accessories supporting message confirmation list the topics supporting message confirmation below.

Mqttthing can optionally set an accessory as 'offline' when it doesn't receive confirmation messages. By default it does this if a `getOnline` topic hasn't been configured - i.e. if online state isn't already being managed explicitly. However, this behaviour can be overridden. Set `confirmationIndicateOffline` to `true` to indicate offline ('No Response') even when a `getOnline` topic is configured, or set `confirmationIndicateOffline` to `false` to disable offline indication when there is no response.

### Codecs

Rather like [apply functions](#apply-functions), a codec can be used to apply transformations to incoming and outgoing data. Unlike apply functions, a codec is written
in a separate JavaScript file which is referenced by the configuration.

To use a codec, configure the path to its JavaScript file using the `codec` configuration setting. The codec will then be called to encode data before 
publishing and to decode received data for all configured topics. The codec can decide which topics and properties to process, and can suppress messages 
and generate additional messages as required.

A codec is a Node.js module which makes encode() and decode() functions available, which are called for all properties or specific properties of the configured 
accessory. For further details, see the example in `test/empty-codec.js` and `test/test-codec.js`.

## Accessories

For configuration details of supported accessories, please see [Accessories.md](Accessories.md).