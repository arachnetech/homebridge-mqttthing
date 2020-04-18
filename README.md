[![npm](https://badgen.net/npm/v/homebridge-mqttthing/latest)](https://www.npmjs.com/package/homebridge-mqttthing)
[![npm](https://badgen.net/npm/dt/homebridge-mqttthing)](https://www.npmjs.com/package/homebridge-mqttthing)
[![Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.gg/MTpeMC)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

# Homebridge MQTT-Thing
[Homebridge MQTT-Thing](https://www.npmjs.com/package/homebridge-mqttthing) is a plugin for [Homebridge](https://github.com/homebridge/homebridge) allowing the integration of [many different accessory types](#supported-accessories) using MQTT.

---

   * [Installation](#installation)
   * [Configuration](#configuration)
   * [Supported Accessories](#supported-accessories)
   * [Release notes](#release-notes)

## Compatibility with previous versions

**From version 1.1.x, raw JavaScript values for Boolean properties are passed to MQTT apply functions.** This may change published message formats, e.g. when apply functions are used to build JSON strings.

For full details of changes please see the [Release notes](#release-notes) section.

# Installation
Follow the instructions in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
This plugin is published through [NPM](https://www.npmjs.com/package/homebridge-mqttthing) and should be installed "globally" by typing:

    npm install -g homebridge-mqttthing

Installation through 
[Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x) is also supported (and recommended).

# Configuration
Configure the plugin in your homebridge `config.json` file. Most configuration settings can now also be entered using 
[Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x).

MQTT topics used fall into two categories:

   * Control topics, of the form `setXXX`, are published by MQTT-Thing in order to 
   * Status/notification topics, of the form `getXXX`, are published by the device to notify MQTT-Thing that something has occurred (e.g. that a sensor has detected something or a control topic action has been performed).


**All values shown below (often within <>) are comments/descriptions, and should not be copied into your configuration file. For an example of an actual configuration file, please see `test/config.json`.**

## Common settings

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

### Applying functions to MQTT messages (custom payload encoding/decoding)

If an MQTT message is not a simple value or does not match the expected syntax, it is possible to specify a JavaScript function that is called for the message every time it is received/published. For this, the topic string in the configuration can be replaced with an object with these properties:

`topic` - Topic string

`apply` - Javascript function to apply (must be a complete function body that `return`s a value). The function is called with one argument: `message`, holding the original message. (optional)

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

### Publishing values on start-up

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

Mqttthing can optionally set an accessory as 'offline' when it doesn't receive confirmation messages. By default it does this is a `getOnline` topic hasn't been configured - i.e. if online state isn't already being managed explicitly. However, this behaviour can be overridden. Set `confirmationIndicateOffline` to `true` to indicate offline ('No Response') even when a `getOnline` topic is configured, or set `confirmationIndicateOffline` to `false` to disable offline indication when there is no response.

# Supported Accessories

   * [Tested Configurations](#Tested-Configurations)
   * [Air Pressure Sensor](#air-pressure-sensor)
   * [Air Quality Sensor](#air-quality-sensor)
   * [Carbon Dioxide Sensor](#carbon-dioxide-sensor)
   * [Contact Sensor](#contact-sensor)
   * [Doorbell](#doorbell)
   * [Fan](#fan)
   * [Garage door opener](#garage-door-opener)
   * [Heater Cooler](#heater-cooler)
   * [Humidity Sensor](#humidity-sensor)
   * [Leak Sensor](#leak-sensor)
   * [Light bulb](#light-bulb)
   * [Light Sensor](#light-sensor)
   * [Lock Mechanism](#lock-mechanism)
   * [Microphone](#microphone)
   * [Motion Sensor](#motion-sensor)
   * [Occupancy Sensor](#occupancy-sensor)
   * [Outlet](#outlet)
   * [Security System](#security-system)
   * [Speaker](#speaker)
   * [StatelessProgrammableSwitch](#statelessprogrammableswitch)
   * [Switch](#switch)
   * [Television](#television)
   * [Temperature Sensor](#temperature-sensor)
   * [Thermostat](#thermostat)
   * [Valve (Sprinkler, Shower, Faucet)](#valve)
   * [Weather Station](#weather-station)
   * [Window](#window)
   * [Window Covering (Blinds)](#window-covering)
   
## Tested Configurations

Tested and working configurations for devices are available on the [Wiki](https://github.com/arachnetech/homebridge-mqttthing/wiki/Tested-Configurations).  Please add your working configurations for others.


## Air Pressure Sensor

Air Pressure must be in the range 700 to 1100 hPa.

*Air Pressure Sensor is only supported in Eve-App*

```javascript
{
    "accessory": "mqttthing",
    "type": "airPressureSensor",
    "name": "<name of sensor>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getAirPressure":        "<topic used to provide 'air pressure'>",
        "getStatusActive":       "<topic used to provide 'active' status (optional)>",
        "getStatusFault":        "<topic used to provide 'fault' status (optional)>",
        "getStatusTampered":     "<topic used to provide 'tampered' status (optional)>",
        "getStatusLowBattery":   "<topic used to provide 'low battery' status (optional)>"
    },
    "history": "<true to enable History service for Eve App (optional)>"
}
```


## Air Quality Sensor

Air quality state can be `UNKNOWN`, `EXCELLENT`, `GOOD`, `FAIR`, `INFERIOR` or `POOR`. To use different values, specify them in **airQualityValues** in that order.

For Air Quality History (in the Eve-App) you have to use `getAirQualityPPM`.

```javascript
{
    "accessory": "mqttthing",
    "type": "airQualitySensor",
    "name": "<name of device>",
    "serviceNames": {
        "temperature": "<name for temperature service (optional)>",
        "humidity":    "<name for humidity service (optional)>"
    },
    "topics":
    {
        "getAirQuality":              "<topic used to report air quality",
        "getCarbonDioxideLevel":      "<topic used to report carbon dioxide level (optional)>",
        "getPM10Density":             "<topic used to report PM10 Density (optional)>",
        "getPM2_5Density":            "<topic used to report PM2.5 Density (optional)>",
        "getOzoneDensity":            "<topic used to report Ozone Density (optional)>",
        "getNitrogenDioxideDensity":  "<topic used to report NitrogenDioxide Density (optional)>",
        "getSulphurDioxideDensity":   "<topic used to report Sulphur Dioxide Density (optional)>",
        "getVOCDensity":              "<topic used to report VOC Density (optional)>",
        "getCarbonMonoxideLevel":     "<topic used to report Carbon Monoxide level (optional)>",
        "getAirQualityPPM":           "<topic used to report air quality voc in ppm (optional, Eve-only)>",
        "getStatusActive":            "<topic used to provide 'active' status (optional)>",
        "getStatusFault":             "<topic used to provide 'fault' status (optional)>",
        "getStatusTampered":          "<topic used to provide 'tampered' status (optional)>",
        "getStatusLowBattery":        "<topic used to provide 'low battery' status (optional)>",
        "getCurrentTemperature":      "<topic used to provide 'current temperature' (optional)>",
        "getCurrentRelativeHumidity": "<topic used to provide 'current relative humidity' (optional)>"
    },
    "airQualityValues": [ "unknown-value", "excellent-value", "good-value", "fair-value", "inferior-value", "poor-value" ],
    "history": "<true to enable History service for Eve App (optional)>"
}
```


## Carbon Dioxide Sensor

Carbon dioxide detected state can be `NORMAL` or `ABNORMAL`. To use different values, specify them in **carbonDioxideDetectedValues** in that order.

```javascript
{
    "accessory": "mqttthing",
    "type": "carbonDioxideSensor",
    "name": "<name of device>",
    "topics":
    {
        "getCarbonDioxideDetected":     "<topic used to report carbon dioxide detected",
        "getCarbonDioxideLevel":        "<topic used to report carbon dioxide level (optional)>",
        "getCarbonDioxidePeakLevel":    "<topic used to report carbon dioxide level (optional)>",
        "getStatusActive":              "<topic used to provide 'active' status (optional)>",
        "getStatusFault":               "<topic used to provide 'fault' status (optional)>",
        "getStatusTampered":            "<topic used to provide 'tampered' status (optional)>",
        "getStatusLowBattery":          "<topic used to provide 'low battery' status (optional)>"
    },
    "carbonDioxideDetectedValues": [ "normal-value", "abnormal-value" ]
}
```


## Contact Sensor

Contact sensor state is exposed as a Boolean. True (or 1 with integer values) maps to `CONTACT_NOT_DETECTED` (sensor triggered)
and False (or 0) maps to `CONTACT_DETECTED` (not triggered). To use different MQTT values, configure `onValue` and `offValue`.

If `history` is enabled, this plugin will count the number of openings and offers the possibility to reset the counter from the Eve app.

```javascript
{
    "accessory": "mqttthing",
    "type": "contactSensor",
    "name": "<name of sensor>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getContactSensorState": "<topic used to provide 'contact sensor' state>",
        "getStatusActive":       "<topic used to provide 'active' status (optional)>",
        "getStatusFault":        "<topic used to provide 'fault' status (optional)>",
        "getStatusTampered":     "<topic used to provide 'tampered' status (optional)>",
        "getStatusLowBattery":   "<topic used to provide 'low battery' status (optional)>"
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>",
    "resetStateAfterms": "<milliseconds after which to reset state automatically (optional)>",
    "history": "<true to enable History service for Eve App (optional)>"
}
```


## Doorbell

Doorbell ring switch state can be be `SINGLE_PRESS`, `DOUBLE_PRESS` or `LONG_PRESS`. By default, these events are raised when values of `1`, `2` and `L` respectively are published to the **getSwitch** topic. However, these values may be overridden by specifying an alternative array in the **switchValues** setting.

```javascript
{
    "accessory": "mqttthing",
    "type": "doorbell",
    "name": "<name of sensor>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getSwitch":         "<topic used to provide doorbell switch state>"
        "getBrightness":     "<topic used to get brightness (optional)>",
        "setBrightness":     "<topic used to set brightness (optional)>",
        "getVolume":         "<topic used to get volume (optional)>",
        "setVolume":         "<topic used to set volume (optional)>",
        "getMotionDetected": "<topic used to provide 'motion detected' status (optional, if exposing motion sensor)>"
    },
    "switchValues": "<array of 3 switch values corresponding to single-press, double-press and long-press respectively (optional)>"
}
```

## Fan

Fan running state ('on') is true or false, or 1 or 0 if `integerValue: true` specified.

Fan rotation direction is 0 for clockwise or 1 for anticlockwise.

Fan rotation speed is an integer between 0 (off) and 100 (full speed).

Set `confirmationPeriodms` to enable publishing confirmation for `setOn`/`getOn`. The accessory must echo messages it receives through the `setOn` subject to the `getOn` subject, otherwise homebridge-mqttthing will mark it as unresponsive and republish on the `setOn` subject.

```javascript
{
    "accessory": "mqttthing",
    "type": "fan",
    "name": "<name of sensor>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getOn":                "<topic to notify homebridge of 'fan on' status>",
        "setOn":                "<topic published by homebridge to set 'fan on' status>",
        "getRotationDirection": "<topic to notify homebridge of rotation direction (optional)> ",
        "setRotationDirection": "<topic published by homebridge to set rotation direction (optional)>",
        "getRotationSpeed":     "<topic to notify homebridge of rotation speed (optional)",
        "setRotationSpeed":     "<topic published by homebridge to set rotation speed (optional)"
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>",
    "turnOffAfterms": "<milliseconds after which to turn off automatically (optional)>"
}
```

## Garage Door Opener

Garage door opener *target* state can be **OPEN** or **CLOSED**. By default, values of `O` and `C` are used respectively (unless changed through **doorTargetValues**). Homekit always assumes that the door is moving towards is target state, so to control it externally you must publish the getTargetDoorState topic to notify Homekit of the new target state. (You may also wish to publish the setTargetDoorState topic to notify your accessory of the new target state.) The same topic may be used for both to simplify this.

Garage door opener *current* door state can be **OPEN**, **CLOSED**, **OPENING**, **CLOSING**, **STOPPED**. By default, these use values of `O`, `C`, `o`, `c` and `S` respectively; these defaults can be changed using the **doorCurrentValues** setting. As a simpler alternative, `getDoorMoving` may be used to specify a Boolean topic indicating whether or not the garage door is currently moving. Mqttthing will generate an appropriate current state automatically, assuming that the door is moving towards its target state or stopped at its target state.

If the *current* and *target* state values are the same (but non-default), these can be changed together by using the **doorValues** setting.

Lock current state can be **UNSECURED**, **SECURED**, **JAMMED** or **UNKNOWN**. By default, these use values of `U`, `S`, `J`, `?` respectively; these can be changed using the **lockValues** setting.

Lock target state can be **UNSECURED** or **SECURED**. By default, these use values of `U` and `S` respectively (unless changed through **lockValues**).

```javascript
{
    "accessory": "mqttthing",
    "type": "garageDoorOpener",
    "name": "<name of sensor>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "setTargetDoorState":       "test/garage/target",
        "getTargetDoorState":       "test/garage/target",
        "getCurrentDoorState":      "test/garage/current",
        "setLockTargetState":       "test/garagelock/target",
        "getLockTargetState":       "test/garagelock/target",
        "getLockCurrentState":      "test/garagelock/current",
        "getObstructionDetected":   "test/garage/obstruction"
    },
    "doorCurrentValues": [ "Open", "Closed", "Opening", "Closing", "Stopped" ],
    "doorTargetValues": ["open", "close"],
    "lockValues": [ "Unsecured", "Secured", "Jammed",  "Unknown" ]
}
```

### Topics

`setTargetDoorState` - Topic published when the target door state is changed in HomeKit. Values are _final_ `doorValues` (not opening/closing).

`getTargetDoorState` - Topic that may be published to notify HomeKit that the target door state has been changed externally. Values are _final_ `doorValues` (not opening/closing). May use same topic as `getCurrentDoorState` as above. Omit if all control is through HomeKit.

`getCurrentDoorState` - Topic published to notify HomeKit that a door state has been achieved. HomeKit will expect current door state to end up matching target door state. Values are `doorValues`.

`setLockTargetState` - Topic published when the target lock state is changed in HomeKit. Values are `lockValues`.

`getLockTargetState` - Topic that may be published to notify HomeKit that the target lock state has been changed externally. Values are `lockValues`. May use same topic as `getLockCurrentState` as above. Omit if all control is through HomeKit.

`getLockCurrentState` - Topic published to notify HomeKit that a lock state has been achieved. Values are `lockValues`.

`getObstructionDetected` - Topic published to notify HomeKit whether an obstruction has been detected (Boolean value).

### Values

`doorValues` - Array of 5 door values corresponding to open, closed, opening, closing and stopped respectively. If not specified, defaults to `[ 'O', 'C', 'o', 'c', 'S' ]`.

`doorCurrentValues` - Array of 5 door values corresponding to open, closed, opening, closing and stopped respectively. If not specified, defaults to `[ 'O', 'C', 'o', 'c', 'S' ]`.

`doorTargetValues` - Array of 2 door values corresponding to the door *target* values of open or closed, respectively. If not specified, defaults to `[ 'O', 'C' ]`.

`lockValues` - Array of 4 lock values corresponding to unsecured, secured, jammed and unknown respectively. if not specified, defaults to `[ 'U', 'S', 'J', '?' ]`.

`integerValue` - Set to true to use values 1 and 0 instead of "true" and "false" respectively for obstruction detected value.


## Heater Cooler

Current heater/cooler state can be **INACTIVE**, **IDLE**, **HEATING** or **COOLING**. To use different values, specify an array of strings in **currentHeaterCoolerValues**.

Target heater/cooler state can be **AUTO**, **HEAT** or **COOL**. To use different values, specify an array of strings in **targetHeaterCoolerValues**.

Lock physical controls state may be **DISABLED** or **ENABLED**. To use different values, specify an array of strings in **lockPhysicalControlsValues**.

Swing mode state may be **DISABLED** or **ENABLED**. To use different values, specify an array of strings in **swingModeValues**.

Temperature display units can be **CELSIUS** or **FAHRENHEIT**. To use different values, specify an array of strings in `temperatureDisplayUnitsValues`.

`minTemperature` and `maxTemperature` may optionally be used to change the minimum and maximum heating and cooling target and temperatures that can be set from Homekit (and also affect current temperature range).

Configure `restrictHeaterCoolerState` to an array of integers to restrict the target heating/cooling states made available by Homekit, where 0 represents AUTO, 1 HEAT and 2 COOL, for example:

   * `"restrictHeaterCoolerState": [0, 1]` - for AUTO or HEAT (but no COOL).
   * `"restrictHeaterCoolerState": [1, 2]` - for HEAT or COOL (but no AUTO).

Configure cooling threshold temperature unless target heater/cooler states exclude **COOL**, and/or heating threshold temperature unless target heater/cooler states exclude **HEAT**.

```javascript
{
    "accessory": "mqttthing",
    "type": "heaterCooler",
    "name": "<name of device>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "logMqtt": true | false,
    "topics": {
        "setActive":                        "<topic used to control 'active' state>",
        "getActive":                        "<topic used to report 'active' state>",
        "getCurrentHeaterCoolerState":      "<topic used to report 'current heater/cooler state'>",
        "setTargetHeaterCoolerState":       "<topic used to control 'target heater/cooler state'>",
        "getTargetHeaterCoolerState":       "<topic used to report 'target heater/cooler state'>",
        "getCurrentTemperature":            "<topic used to report 'current temperature'>",
        "setCoolingThresholdTemperature":   "<topic used to control 'cooling threshold temperature'>",
        "getCoolingThresholdTemperature":   "<topic used to report 'cooling threshold temperature'>",
        "setHeatingThresholdTemperature":   "<topic used to control 'heating threshold temperature'>",
        "getHeatingThresholdTemperature":   "<topic used to report 'heating threshold temperature'>",
        "setTemperatureDisplayUnits":       "<topic used to control 'temperature display units'>",
        "getTemperatureDisplayUnits":       "<topic used to report 'temperature display units'>",
        "setRotationMode":                  "<topic used to control 'rotation mode' (optional)",
        "getRotationMode":                  "<topic used to report 'rotation mode' (optional)",
        "setSwingMode":                     "<topic used to control 'swing mode' (optional)",
        "getSwingMode":                     "<topic used to report 'swing mode' (optional)",
        "setRotationSpeed":                 "<topic used to control 'rotation speed' (optional)",
        "getRotationSpeed":                 "<topic used to report 'rotation speed' (optional)"
    },
    "targetHeaterCoolerValues":             "<array of values to be used to represent AUTO, HEAT, COOL respectively (optional)>",
    "lockPhysicalControlsValues":           "<array of values to be used to represent DISABLED and ENABLED respectively (optional)>",
    "swingModeValues":                      "<array of values to be used to represent DISABLED and ENABLED respectively (optional)>",
    "temperatureDisplayUnitsValues":        "<array of values to be used to represent Celsius and Fahrenheit respectively (optional)>",
    "minTemperature":                       minimum_target_temperature,
    "maxTemperature":                       maximum_target_temperature,
    "restrictHeaterCoolerState":            "<array of allowed values - see notes above (optional)>"
}
```


## Humidity Sensor

Current relative humidity must be in the range 0 to 100 percent with no decimal places.

```javascript
{
    "accessory": "mqttthing",
    "type": "humiditySensor",
    "name": "<name of sensor>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getCurrentRelativeHumidity":   "<topic used to provide 'current relative humidity'>",
        "getStatusActive":              "<topic used to provide 'active' status (optional)>",
        "getStatusFault":               "<topic used to provide 'fault' status (optional)>",
        "getStatusTampered":            "<topic used to provide 'tampered' status (optional)>",
        "getStatusLowBattery":          "<topic used to provide 'low battery' status (optional)>"
    },
    "history": "<true to enable History service for Eve App (optional)>"
}
```


## Leak Sensor

Leak sensor state is exposed as a Boolean. True (or 1 with integer values) maps to `LEAK_DETECTED` 
and False (or 0) maps to `LEAK_NOT_DETECTED`. To use different MQTT values, configure `onValue` and `offValue`.

```javascript
{
    "accessory": "mqttthing",
    "type": "leakSensor",
    "name": "<name of sensor>",
    "topics":
    {
        "getLeakDetected":              "<topic used to provide 'leak detected' state (Boolean)>",
    },
    "resetStateAfterms": "<milliseconds after which to reset state automatically (optional)>"
}
```


## Light bulb

Light bulb can either use separate topics (for on, brightness, hue and saturation), or it can be configured to use a combined value holding comma-separated hue,sat,val or red,green,blue. 

Hue is 0-360. Saturation is 0-100. Brightness is 0-100. Red, green and blue are 0-255. Colour temperature ranges from 140 (cold white) to 500 (warm white), centred at about 151.

If `topics.setHSV` is populated, a combined value is used and any individual brightness, hue and saturation topics are ignored. On/off is sent with `setOn` if configured, or by setting V to 0 when off.

If `topics.setRGB` is populated, a combined value is used in the format red,green,blue (ranging from 0-255). On/off may be sent with `setOn`; brightness, hue and saturation topics are ignored. If `topics.setWhite` is also populated, the white level is extracted and sent separately to the combined RGB value.

Configuring `topics.setWhite` without `topics.setRGB` will give a dimmable white light with a range from 0 (off) to 255 (full brightness) using the `setWhite` topic only (i.e. with no separate on/off state through `setOn`).

If `topics.setRGBW` is populated, a combined value is used in the format red,green,blue,white (ranging from 0-255). The minimum of red, green and blue is subtracted from all three colour channels and sent to the white channel instead. On/off may be set with `setOn` (otherwise "0,0,0,0" indicates off); brightness, hue, saturation and temperature topics are ignored.

If `topics.setRGBWW` is populated, a combined value is used in the format red,green,blue,warm_white,cold_white (each component ranging from 0-255). Warm and cold white components are set based on the colour values published by Homekit from the _Temperature_ control, and after warm and cold white are extracted any remaining white level in the RGB values is sent equally to both white channels. The RGB values used for warm white and cold white extraction can be configured with `warmWhite` and `coldWhite`, allowing calibration to RGBWW LED colours. (Homekit's warm white and cold white colours are used by default.) On/off may be set with `setOn` (otherwise "0,0,0,0,0" indicates off); brightness, hue, saturation and temperature topics are ignored. (Homekit's behaviour when a coloured (hue/saturation-supporting) light also attempts to support temperature can be unpredictable - so the RGBWW implementation does not use Homekit colour temperature.)

Set `confirmationPeriodms` to enable publishing confirmation for `setOn`/`getOn`. The accessory must echo messages it receives through the `setOn` subject to the `getOn` subject, otherwise homebridge-mqttthing will mark it as unresponsive and republish on the `setOn` subject.

```javascript
{
    "accessory": "mqttthing",
    "type": "lightbulb",
    "name": "<name of lightbulb>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getOn": 	        "<topic to get the status>",
        "setOn": 	        "<topic to set the status>",
        "getBrightness": 	"<topic to get the brightness (optional)>",
        "setBrightness": 	"<topic to set the brightness (optional - if dimmable)>",
        "getHue": 	        "<topic to get the hue (optional)>",
        "setHue": 	        "<topic to set the hue (optional - if coloured)>",
        "getSaturation": 	"<topic to get the saturation (optional)>",
        "setSaturation": 	"<topic to set the saturation (optional - if coloured)>",
        "getHSV":           "<in HSV mode, topic to get comma-separated hue, saturation and value>",
        "setHSV":           "<in HSV mode, topic to set comma-separated hue, saturation and value>",
        "getRGB":           "<in RGB mode, topic to get comma-separated red, green, blue>",
        "setRGB":           "<in RGB mode, topic to set comma-separated red, green, blue>",
        "getRGBW":          "<in RGBW mode, topic to get comma-separated red, green, blue, white>",
        "setRGBW":          "<in RGBW mode, topic to set comma-separated red, green, blue, white>",
        "getRGBWW":         "<in RWGWW mode, topic to get comma-separated red, green, blue, warm_white, cold_white>",
        "setRGBWW":         "<in RWGWW mode, topic to set comma-separated red, green, blue, warm_white, cold_white>",
        "getWhite":         "<topic to get white level (0-255)> - used with getRGB for RGBW with separately-published white level",
        "setWhite":         "<topic to set white level (0-255)> - used with setRGB for RGBW with separately-published white level",
        "getColorTemperature": "<topic to report color temperature (140-500) (optional)>",
        "setColorTemperature": "<topic to control color temperature (140-500) (optional)>"
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>",
    "hex": "true to format combined RGB/RGBW in hexadecimal instead of as comma-separated decimals",
    "hexPrefix": "format combined RGB/RGBW in hexadecimal with specified prefix (typically '#') instead of as comma-separated decimals",
    "turnOffAfterms": "<milliseconds after which to turn off automatically (optional)>",
    "warmWhite": "in RGBWW mode, RGB value of warm white in format red,green,blue (optional)",
    "coldWhite": "in RGBWW mode, RGB value of cold white in format red,green,blue (optional)"
}
```

When using config-ui-x, multiple lightbulb types are available. The generic 'lightbulb' allows all possible settings to be entered. Serveral sub-types ('lightbulb-OnOff', 'lightbulb-Dimmable' etc.) show the configuration settings relevant for specific light types only. This can greatly simplify the configuration process.

## Light Sensor

Current ambient light level must be in the range 0.0001 Lux to 100000 Lux to a maximum of 4dp.

```javascript
{
    "accessory": "mqttthing",
    "type": "lightSensor",
    "name": "<name of sensor>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getCurrentAmbientLightLevel":  "<topic used to provide 'current ambient light level'>",
        "getStatusActive":              "<topic used to provide 'active' status (optional)>",
        "getStatusFault":               "<topic used to provide 'fault' status (optional)>",
        "getStatusTampered":            "<topic used to provide 'tampered' status (optional)>",
        "getStatusLowBattery":          "<topic used to provide 'low battery' status (optional)>"
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>"
}
```


## Lock Mechanism

Lock current state can be **UNSECURED**, **SECURED**, **JAMMED** or **UNKNOWN**. By default, these use values of `U`, `S`, `J`, `?` respectively; these can be changed using the **lockValues** setting.

Lock target state can be **UNSECURED** or **SECURED**. By default, these use values of `U` and `S` respectively (unless changed through **lockValues**).

```javascript
{
    "accessory": "mqttthing",
    "type": "lockMechanism",
    "name": "<name of sensor>",
    "topics":
    {
        "setLockTargetState":       "test/lock/target",
        "getLockTargetState":       "test/lock/current",
        "getLockCurrentState":      "test/lock/current"
    },
    "lockValues": [ "Unsecured", "Secured", "Jammed",  "Unknown" ]
}
```

### Topics

`setLockTargetState` - Topic published when the target lock state is changed in HomeKit. Values are `lockValues`.

`getLockTargetState` - Topic that may be published to notify HomeKit that the target lock state has been changed externally. Values are `lockValues`. May use same topic as `getLockCurrentState` as above. Omit if all control is through HomeKit.

`getLockCurrentState` - Topic published to notify HomeKit that a lock state has been achieved. Values are `lockValues`.

### Values

`lockValues` - Array of 4 lock values corresponding to unsecured, secured, jammed and unknown respectively. if not specified, defaults to `[ 'U', 'S', 'J', '?' ]`.


## Microphone

```javascript
{
    "accessory": "mqttthing",
    "type": "microphone",
    "name": "<name of sensor>",
    "topics":
    {
        "getMute":              "<topic used to indicate whether microphone is muted (Boolean)>",
        "setMute":              "<topic used to set whether microphone is muted (Boolean)>",
        "getVolume":            "<topic used to report current volume (0-100)>",
        "setVolume":            "<topic used to set volume (0-100)>"
    }
}
```


## Motion Sensor

```javascript
{
    "accessory": "mqttthing",
    "type": "motionSensor",
    "name": "<name of sensor>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getMotionDetected":         "<topic used to provide 'motion detected' status>",
        "getStatusActive":           "<topic used to provide 'active' status (optional)>",
        "getStatusFault":            "<topic used to provide 'fault' status (optional)>",
        "getStatusTampered":         "<topic used to provide 'tampered' status (optional)>",
        "getStatusLowBattery":       "<topic used to provide 'low battery' status (optional)>"
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>",
    "turnOffAfterms": "<milliseconds after which to reset motion sensor state automatically (optional) - allowing a motion sensor just to publish its onValue>",
    "history": "<true to enable History service for Eve App (optional)>"
}
```


## Occupancy Sensor

Occupancy sensor state is exposed as a Boolean. True (or 1 with integer values) maps to `OCCUPANCY_DETECTED` (sensor triggered)
and False (or 0) maps to `OCCUPANCY_NOT_DETECTED` (not triggered). To use different MQTT values, configure `onValue` and `offValue`.

```javascript
{
    "accessory": "mqttthing",
    "type": "occupancySensor",
    "name": "<name of sensor>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getOccupancyDetected":      "<topic used to provide 'occupancy detected' status>",
        "getStatusActive":           "<topic used to provide 'active' status (optional)>",
        "getStatusFault":            "<topic used to provide 'fault' status (optional)>",
        "getStatusTampered":         "<topic used to provide 'tampered' status (optional)>",
        "getStatusLowBattery":       "<topic used to provide 'low battery' status (optional)>"
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>"
}
```


## Outlet

An outlet can be configured as a light or as a fan in the Home app.

If `history` is enabled and no `getTotalConsumption` topic is defined, this plugin will count the total consumption (kWh) by itself and offers the possibility to reset the counter from the Eve app.
The interval of `getWatts` data updates should be less then 10min and at best periodic, in order to avoid averaging errors for the history entries.

Set `confirmationPeriodms` to enable publishing confirmation for `setOn`/`getOn`. The accessory must echo messages it receives through the `setOn` subject to the `getOn` subject, otherwise homebridge-mqttthing will mark it as unresponsive and republish on the `setOn` subject.

```javascript
{
    "accessory": "mqttthing",
    "type": "outlet",
    "name": "<name of outlet>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getOn":                "<topic to get the status>",
        "setOn":                "<topic to set the status>",
        "getInUse":             "<topic used to provide 'outlet is in use' feedback>",
        "getWatts":             "<topic used to provide 'current consumption' [Watts] (optional, Eve-App-only)>",
        "getVolts":             "<topic used to provide 'voltage' [Volts] (optional, Eve-App-only)>",
        "getAmperes":           "<topic used to provide 'electricCurrent' [Amperes] (optional, Eve-App-only)>",
        "getTotalConsumption":  "<topic used to provide 'totalConsumption' [kWh] (optional, Eve-App-only)>"
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>",
    "turnOffAfterms": "<milliseconds after which to turn off automatically (optional)>",
    "history": "<true to enable History service for Eve App (optional)>"
}
```


## Security System

Security System current state can be **STAY_ARM**, **AWAY_ARM**, **NIGHT_ARM**, **DISARMED** or **ALARM_TRIGGERED**. By default, these events are raised when values of `SA`, `AA`, `NA`, `D` and `T` respectively are published to the **getCurrentState** topic. However, these values may be overriden by specifying an alternative array in the **currentStateValues** setting.

Security System target state can be **STAY_ARM**, **AWAY_ARM**, **NIGHT_ARM** or **DISARM**. By default, these states correspond to values of `SA`, `AA`, `NA` and `D`. Homebridge expects to control the target state (causing one of these values to be published to the **setTargetState** topic), and to receive confirmation from the security system that the state has been achieved through a change in the current state (received through the **getCurrentState** topic). The values used for target state can be specified as an an array in the **targetStateValues** setting.

Homebridge publishes a value to the **setTargetState** topic to indicate the state that the HomeKit user wishes the alarm to be in. The alarm system must echo this state back to the **getCurrentState** topic to confirm that it has set the alarm state appropriately. The alarm system may also publish the ALARM_TRIGGERED value (`T` by default) to the **getCurrentState** topic in order to indicate that the alarm has been triggered. While homekit is waiting for the state change to be confirmed, it will display 'Arming...' or 'Disarming...'.

Additionally, the alarm system may change its own target state by publishing to **getTargetState**. As with a homekit-controlled state change, this must be followed by a publish to **getCurrentState** to confirm that the change is complete. It is possible to set **getTargetState** and **getCurrentState** to the same MQTT topic, allowing the alarm system to change the target state and confirm that it has been achieved with a single MQTT message.

Configure `restrictTargetState` to an array of integers to restrict the target states made available by Homekit, where 0 represents STAY_ARM, 1 AWAY_ARM, 2 NIGHT_ARM and 3 DISARM, for example:

   * `"restrictTargetState": [0, 1, 3]` - for STAY_ARM, AWAY_ARM and DISARM (but no NIGHT_ARM)

```javascript
{
    "accessory": "mqttthing",
    "type": "securitySystem",
    "name": "<name of sensor>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics": {
        "setTargetState": "test/security/target",
        "getTargetState": "test/security/current",
        "getCurrentState": "test/security/current"
    },
    "targetStateValues": [ "StayArm", "AwayArm", "NightArm", "Disarmed" ],
    "currentStateValues": [ "StayArm", "AwayArm", "NightArm", "Disarmed", "Triggered" ],
    "restrictTargetState": [ 1, 3 ]
}
```

### Topics

`setTargetState` - Topic published when the target alarm state is changed in HomeKit. Values are `targetStateValues`.

`getTargetState` - Topic that may be published to notify HomeKit that the target alarm state has been changed externally. Values are `targetStateValues`. May use same topic as `getCurrentState` as above. Omit if all control is through HomeKit.

`getCurrentState` - Topic published to notify HomeKit that an alarm state has been achieved. HomeKit will expect current state to end up matching target state. Values are `currentStateValues`.

### Values

`targetStateValues` - Array of 4 values for target state corresponding to **STAY_ARM**, **AWAY_ARM**, **NIGHT_ARM** and **DISARMED** respectively. If not specified, defaults to `[ 'SA', 'AA', 'NA', 'D' ]`.

`currentStateValues` - Array of 5 values for current state corresponding to **STAY_ARM**, **AWAY_ARM**, **NIGHT_ARM**, **DISARMED** and **ALARM_TRIGGERED** respectively. If not specified, defaults to `[ 'SA', 'AA', 'NA', 'D', 'T' ]`.


## Smoke Sensor

Smoke sensor state is exposed as a Boolean. True (or 1 with integer values) maps to `SMOKE_DETECTED` 
and False (or 0) maps to `SMOKE_NOT_DETECTED`. To use different MQTT values, configure `onValue` and `offValue`.

```javascript
{
    "accessory": "mqttthing",
    "type": "smokeSensor",
    "name": "<name of sensor>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getSmokeDetected":      "<topic used to provide smoke sensor state>"
        "getStatusActive":       "<topic used to provide 'active' status (optional)>",
        "getStatusFault":        "<topic used to provide 'fault' status (optional)>",
        "getStatusTampered":     "<topic used to provide 'tampered' status (optional)>",
        "getStatusLowBattery":   "<topic used to provide 'low battery' status (optional)>"
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>",
    "resetStateAfterms": "<milliseconds after which to reset state automatically (optional)>"
}
```


## Speaker

```javascript
{
    "accessory": "mqttthing",
    "type": "speaker",
    "name": "<name of sensor>",
    "topics":
    {
        "getMute":              "<topic used to indicate whether speaker is muted (Boolean)>",
        "setMute":              "<topic used to set whether speaker is muted (Boolean)>",
        "getVolume":            "<topic used to report current volume (0-100)>",
        "setVolume":            "<topic used to set volume (0-100)>"
    }
}
```


## StatelessProgrammableSwitch

Like a doorbell (which is based on it), the state of a stateless programmable switch can be be `SINGLE_PRESS`, `DOUBLE_PRESS` or `LONG_PRESS`. By default, these events are raised when values of `1`, `2` and `L` respectively are published to the **getSwitch** topic. However, these values may be overridden by specifying an alternative array in the **switchValues** setting.

The states can be restricted to a subset of these three values available in HomeKit by the **restrictSwitchValues** setting, where 0 represents `SINGLE_PRESS`, 1 `DOUBLE_PRESS`, and 2 `LONG_PRESS`, for example:

   * `"restrictSwitchValues": [0, 2]` - for `SINGLE_PRESS` and `LONG_PRESS`, (but no `DOUBLE_PRESS`)

Additionally, multiple buttons (each potentially with a single, double, and long press action) may be added to a single statelessProgrammableSwitch. This is accomplished by setting the **getSwitch** topic to an array of topics. The number of elements in this array equals the number of buttons on the switch. For example:

* `"getSwitch": ["<button topic 1>", "<button topic 2>", "<button topic 3>"]` - for a 3 button switch

The **switchValues** and **restrictSwitchValues** options also support an array of values such that each switch may different switch values and different allowed button press sequences. A single array of values (like that used for a single) will result in that value being applied to all buttons.

```javascript
{
    "accessory": "mqttthing",
    "type": "statelessProgrammableSwitch",
    "name": "<name of sensor>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getSwitch":            "<topic used to provide switch state>"
    },
    "switchValues": "<array of 3 switch values corresponding to single-press, double-press and long-press respectively (optional)>"
    "restrictSwitchValues": [ 0, 1 ] // optional
}

// Multi-button switch
{
    "accessory": "mqttthing",
    "type": "statelessProgrammableSwitch",
    "name": "<name of sensor>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getSwitch":
            [
                "<topic used to provide switch 1 state>",
                "<topic used to provide switch 2 state>",
                "<topic used to provide switch 3 state>"
            ]           
    },
    "switchValues":
        [
            "<array of 3 switch values corresponding to single-press, double-press and long-press respectively for switch 1 (optional)>"
            "<array of 3 switch values corresponding to single-press, double-press and long-press respectively for switch 2 (optional)>"
            "<array of 3 switch values corresponding to single-press, double-press and long-press respectively for switch 3 (optional)>"
        ]
    "switchValues": "<array of 3 switch values corresponding to single-press, double-press and long-press respectively (optional)>"
    "restrictSwitchValues": [ 0, 2 ] // optional and applied to all buttons
}
```


## Switch

On/off switch.

Configuring `turnOffAfter` causes the switch to turn off automatically the specified number of milliseconds after it is turned on by homekit.

Configuring `resetStateAfterms` causes the switch state as reported through the `getOn` topic to be reset to off after the specified number of milliseconds. Use when there is no `setOn` topic.

Set `confirmationPeriodms` to enable publishing confirmation for `setOn`/`getOn`. The accessory must echo messages it receives through the `setOn` subject to the `getOn` subject, otherwise homebridge-mqttthing will mark it as unresponsive and republish on the `setOn` subject.

```javascript
{
    "accessory": "mqttthing",
    "type": "switch",
    "name": "<name of switch>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getOn": 	        "<topic to get the status>",
        "setOn": 	        "<topic to set the status>"
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>",
    "turnOffAfterms": "<milliseconds after which to turn off automatically (optional)>",
    "resetStateAfterms": "<milliseconds after which to reset state automatically (optional)>",
    "history": "<true to enable History service for Eve App (optional)>"
}
```


## Television

Different input sources (Live TV, HDMI1, HDMI2, ...) can be defined within the array `inputs` (optional). If this is not used, `setActiveInput` and `getActiveInput` have no effect.

To send remote key commands (`setRemoteKey`), you can use the remote control within the (iOS) control center.

```javascript
{
    "accessory": "mqttthing",
    "type": "television",
    "name": "<name of TV>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "setActive":            "<topic to set the status>",
        "getActive":            "<topic to get the status>",
        "setActiveInput":       "<topic to set the active input source (optional)>",
        "getActiveInput":       "<topic to get the active input source (optional)>",
        "setRemoteKey":         "<topic for publishing remote key actions (optional)>"
    },
    "inputs": [
        {
            "name":     "<name for first input source>",
            "value":    "<MQTT value for first input source>"
        },
        {
            "name":     "<name for second input source>",
            "value":    "<MQTT value for second input source>"
        },
        ...
    ],
    "integerValue":     "<true to use 1|0 instead of true|false default onValue and offValue>",
    "onValue":          "<value representing on (optional)>",
    "offValue":         "<value representing off (optional)>",
}
```


## Temperature Sensor

Current temperature is specified in degrees Celsius, to a maximum of 1dp.

```javascript
{
    "accessory": "mqttthing",
    "type": "temperatureSensor",
    "name": "<name of sensor>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getCurrentTemperature":        "<topic used to provide 'current temperature'>",
        "getStatusActive":              "<topic used to provide 'active' status (optional)>",
        "getStatusFault":               "<topic used to provide 'fault' status (optional)>",
        "getStatusTampered":            "<topic used to provide 'tampered' status (optional)>",
        "getStatusLowBattery":          "<topic used to provide 'low battery' status (optional)>"
    },
    "history": "<true to enable History service for Eve App (optional)>",
    "minTemperature": minimum_target_temperature,
    "maxTemperature": maximum_taret_temperature
}
```

`minTemperature` and `maxTemperature` may optionally be used to change the minimum and maximum temperature allowed by Homekit from its default range of 0-100 C. If neither option is specified, mqttthing lowers the minimum temperature to -100 C (for compatibility with earlier versions of mqttthing).


## Thermostat

Current heating/cooling state can be **OFF**, **HEAT** or **COOL**. Target heating/cooling state can be **OFF**, **HEAT**, **COOL** or **AUTO**. To use different values, specify an array of strings in `heatingCoolingStateValues`.

Temperature display units can be **CELSIUS** or **FAHRENHEIT**. To use different values, specify an array of strings in `temperatureDisplayUnitsValues`.

`minTemperature` and `maxTemperature` may optionally be used to change the minimum and maximum target temperatures that can be set from Homekit (defaulting to 10 and 38 respectively).

Configure `restrictHeatingCoolingState` to an array of integers to restrict the target heating/cooling states made available by Homekit, where 0 represents OFF, 1 HEAT, 2 COOL and 3 AUTO, for example:

   * `"restrictHeatingCoolingState": [0, 1, 2]` - for OFF, HEAT and COOL (but no AUTO)
   * `"restrictHeatingCoolingState": [0, 1]` - for OFF or HEAT only

```javascript
{
    "accessory": "mqttthing",
    "type": "thermostat",
    "name": "<name of device>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "topics":
    {
        "getCurrentHeatingCoolingState":  "<topic used to report 'current heating/cooling state'>",
        "setTargetHeatingCoolingState":   "<topic used to control 'target heating/cooling state'>",
        "getTargetHeatingCoolingState":   "<topic used to report 'target heating/cooling state'>",
        "getCurrentTemperature":          "<topic used to report 'current temperature'>",
        "setTargetTemperature":           "<topic used to control 'target temperature'>",
        "getTargetTemperature":           "<topic used to report 'target temperature'>",
        "setTemperatureDisplayUnits":     "<topic used to control 'temperature display units'>",
        "getTemperatureDisplayUnits":     "<topic used to report 'temperature display units'>",
        "getCurrentRelativeHumidity":     "<topic used to report 'current relative humidity' (optional)>",
        "setTargetRelativeHumidity":      "<topic used to control 'target relative humidity' (optional)>",
        "getTargetRelativeHumidity":      "<topic used to report 'target relative humidity' (optional)>",
        "setCoolingThresholdTemperature": "<topic used to control 'cooling threshold temperature' (optional)>",
        "getCoolingThresholdTemperature": "<topic used to report 'cooling threshold temperature' (optional)>",
        "setHeatingThresholdTemperature": "<topic used to control 'heating threshold temperature' (optional)>",
        "getHeatingThresholdTemperature": "<topic used to report 'heating threshold temperature' (optional)>"
    },
    "heatingCoolingStateValues": "<array of values to be used to represent Off, Heat, Cool and Auto respectively (optional)>",
    "temperatureDisplayUnitsValues": "<array of values to be used to represent Celsius and Fahrenheit respectively (optional)>",
    "minTemperature": minimum_target_temperature,
    "maxTemperature": maximum_taret_temperature,
    "restrictHeatingCoolingState": "<array of allowed values - see notes above (optional)>"
}
```


## Valve

`valveType` can be `"sprinkler"`, `"shower"` or `"faucet"`.

If `durationTimer` is set to **true**, this plugin will provide additional characteristics to set the standard duration for the valve and will stop the water flow after this time.

If the device itself provides duration timing via MQTT or if you want to query or set the duration via MQTT, you can make use of `setDuration`/`getDuration`. The remaining time is shown in HomeKit even if no `getRemainingDuration` is configured. `getRemainingDuration` can be used to update the remaining time, if the duration is changed at the device itself in some way.

The default run time defaults to between 5 minutes and 1 hour (in 5 minute increments). This can be changed with `minDuration` and `maxDuration`. Note however that the Home App in iOS 12 doesn't like to show durations below 5 minutes. (This appears to have been improved in the iOS 13 Beta.)

Configuring `turnOffAfterms` causes the valve to turn off automatically the specified (fixed!) number of milliseconds after it is turned on by homekit. It can be used instead of `durationTimer` or `setDuration`/`getDuration`. 

```javascript
{
    "accessory": "mqttthing",
    "type": "valve",
    "valveType": "<valve type>",
    "name": "<name of valve>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "setActive":            "<topic to set the target status>",
        "getActive":            "<topic to get the target status>",
        "getInUse":             "<topic to get the current status>",
        "setDuration":          "<topic used to set default duration (seconds) (optional, with external timer)>",
        "getDuration":          "<topic used to get default duration (seconds) (optional, with external timer)>",
        "getRemainingDuration": "<topic used to get remaining duration (seconds) (optional, with external timer)>",
        "getStatusActive":      "<topic used to provide 'active' status (optional)>",
        "getStatusFault":       "<topic used to provide 'fault' status (optional)>",
        "getStatusTampered":    "<topic used to provide 'tampered' status (optional)>",
        "getStatusLowBattery":  "<topic used to provide 'low battery' status (optional)>"
    },
    "integerValue":     "<true to use 1|0 instead of true|false default onValue and offValue>",
    "onValue":          "<value representing on (optional)>",
    "offValue":         "<value representing off (optional)>",
    "durationTimer":    "<true to enable duration timer (optional, recommended)>",
    "turnOffAfterms":   "<milliseconds after which to turn off automatically (optional, fix duration)>",
    "minDuration":      "<minimum duration (in seconds)>",
    "maxDuration":      "<maximum duration (in seconds)>"
}
```


## Weather Station

Current temperature must be in the range 0 to 100 degrees Celsius to a maximum of 1dp.

Current relative humidity must be in the range 0 to 100 percent with no decimal places.

Air Pressure must be in the range 700 to 1100 hPa.

*Air Pressure and the special weather characteristics (rain, wind, ...) are only supported in Eve-App*

Weather condition and wind direction are custom string values.

```javascript
{
    "accessory": "mqttthing",
    "type": "weatherStation",
    "name": "<name of sensor>",
    "serviceNames": {
        "temperature": "<name for temperature service (optional)>",
        "humidity":    "<name for humidity service (optional)>",
        "airPressure": "<name for air pressure service (optional)>",
        "weather":     "<name for weather service (optional)>"
    },
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "topics":
    {
        "getCurrentTemperature":        "<topic used to provide 'current temperature'>",
        "getCurrentRelativeHumidity":   "<topic used to provide 'current relative humidity (optional)'>",
        "getAirPressure":               "<topic used to provide 'air pressure' (optional, Eve-only)>",
        "getWeatherCondition":          "<topic used to provide 'weather condition' (optional, Eve-only)>",
        "getRain1h":                    "<topic used to provide 'rain [mm] in last 1h' (optional, Eve-only)>",
        "getRain24h":                   "<topic used to provide 'rain [mm] in last 24h' (optional, Eve-only)>",
        "getUVIndex":                   "<topic used to provide 'UV index' (optional, Eve-only)>",
        "getVisibility":                "<topic used to provide 'visibility [km]' (optional, Eve-only)>",
        "getWindDirection":             "<topic used to provide 'wind direction' (optional, Eve-only)>",
        "getWindSpeed":                 "<topic used to provide 'wind speed [km/h]' (optional, Eve-only)>",
        "getStatusActive":              "<topic used to provide 'active' status (optional)>",
        "getStatusFault":               "<topic used to provide 'fault' status (optional)>",
        "getStatusTampered":            "<topic used to provide 'tampered' status (optional)>",
        "getStatusLowBattery":          "<topic used to provide 'low battery' status (optional)>"
    },
    "history": "<true to enable History service for Eve App (optional)>"
}
```


## Window 

Window position state can be **DECREASING**, **INCREASING** or **STOPPED**. By default, these use values of `DECREASING`, `INCREASING`, and `STOPPED` respectively; these defaults can be changed using the **positionStateValues** setting.

```javascript
{
    "accessory": "mqttthing",
    "type": "window",
    "name": "<name of device>",
    "topics":
    {
        "getCurrentPosition":           "<topic used to report current position (integer 0-100)>",
        "setTargetPosition":            "<topic used to control target position (integer 0-100)>",
        "getTargetPosition":            "<topic used to report target position (optional)>", 
        "getPositionState":             "<topic used to report position state>",
        "setHoldPosition":              "<topic used to control hold position (Boolean)>",
        "getObstructionDetected":       "<topic used to report whether an obstruction is detected (Boolean)>"
    },
    "positionStateValues": [ "decreasing-value", "increasing-value", "stopped-value" ]
}
```


## Window Covering

Window covering position state can be **DECREASING**, **INCREASING** or **STOPPED**. By default, these use values of `DECREASING`, `INCREASING`, and `STOPPED` respectively; these defaults can be changed using the **positionStateValues** setting.

```javascript
{
    "accessory": "mqttthing",
    "type": "windowCovering",
    "name": "<name of device>",
    "topics":
    {
        "getCurrentPosition":           "<topic used to report current position (integer 0-100)>",
        "setTargetPosition":            "<topic used to control target position (integer 0-100)>",
        "getTargetPosition":            "<topic used to report target position (optional)>", 
        "getPositionState":             "<topic used to report position state>",
        "setHoldPosition":              "<topic used to control hold position (Boolean)>",
        "setTargetHorizontalTiltAngle": "<topic used to control target horizontal tilt angle (-90 to 90)>",
        "getTargetHorizontalTiltAngle": "<topic used to report target horizontal tilt angle (optional)>",
        "getCurrentHorizontalTiltAngle": "<topic used to report current horizontal tilt angle>",
        "setTargetVerticalTiltAngle":   "<topic used to control target vertical tilt angle (-90 to 90)>",
        "getTargetVerticalTiltAngle":   "<topic used to report target vertical tilt angle (optional)>",
        "getCurrentVerticalTiltAngle":   "<topic used to report current vertical tilt angle>",
        "getObstructionDetected":        "<topic used to report whether an obstruction is detected (Boolean)>"
    },
    "positionStateValues": [ "decreasing-value", "increasing-value", "stopped-value" ]
}
```


# Release notes

Version 1.1.9
+ Added persistencePath to historyOptions

Version 1.1.8
+ Garage door add getDoorMoving option as simpler alternative to getCurrentDoorState
+ Changed default garage door state (after restart) to closed

Version 1.1.7
+ Allow temperature sensor current temperature range to be overriden (using minTemperature and maxTemperature)
+ Added confirmationIndicateOffline option
+ Moved history options from history to historyOptions object
+ Added config-ui-x support for historyOptions

Version 1.1.6
+ Added history support for switch (thanks, @tobekas)
+ Fixed #223 and #207 - history not working if getTotalConsumption used (thanks, @tobekas)
+ Fixed history last activation in motion and contact sensor (thanks, @tobekas)
+ Allowed config.url string without protocol, now defaulting to mqtt:// (thanks, @tobekas)

Version 1.1.5
+ Don't throw an exception at start-up if the configuration is invalid (as this stops Homebridge unnecessarily)

Version 1.1.4
+ Fixed excessive MQTT logging (introduced in 1.1.2). Thanks, @nzbullet.

Version 1.1.3
+ Added lightbulb sub-types to configuration schema, allowing easier configuration of different lightbulb types.
+ Added missing otherValueOff to configuration schema.

Version 1.1.2
+ Added configuration schema, supporting configuration of most settings through config-ui-x (thanks, @oznu). Note that 'apply' functions are not supported.
+ Added new 'startPub' format, allowing configuration through config-ui-x.

Version 1.1.1
+ Changed Boolean value handling to support bare JavaScript Booleans returned from incoming MQTT apply() functions (`"true" != true` but both are now accepted).
+ Boolean property values passed to outgoing MQTT apply() functions are no-longer converted to strings first (for consistency with the change above). This allows easier publishing of JSON containing correctly typed values, but **may change outgoing message format with existing configurations in some situations**.
+ Added option to configure garage door target values independently of current values - thanks, Charles Powell

Version 1.0.50
+ Stateless Programmable Switch: allow multiple buttons under a single switch - thanks, Jacob Nite

Version 1.0.49
+ Stateless Programmable Switch: added option to restrict available switch values - thanks, Jacob Nite

Version 1.0.48
+ Upgrade to latest homebridge-lib (4.4.10 or later)

Version 1.0.47
+ Fix: latest homebridge-lib (introduced in last build) appears incompatible with our references to Eve.Characteristic (e.g. Eve.Characteristic.CurrentConsumption)

Version 1.0.46
+ Suppress logging of MQTT password (issue #150)

Version 1.0.45
+ Allow changing of default run time (duration) range for valve

Version 1.0.44
+ Added HeaterCooler

Version 1.0.43
+ Added option to treat unrecognized received on/off values as off when an explicit off value is configured
+ Security System: Allow target states to be restricted

Version 1.0.42
+ Added publishing confirmation (`setOn` message must be echoed to `getOn` topic to confirm that it has been processed by the accessory), with automatic republishing
+ Added Television (thanks, tobekas)
+ Fix to characteristics with multiple states (thanks, tobekas)

Version 1.0.41
+ Light: Add option to control dimmable white light through integer in range 0-255, so that one channel of an RGB or RGBW controller can be used more easily for a white light

Version 1.0.40
+ Thermostat: Allow target heating/cooling states to be restricted

Version 1.0.39
+ Valve: Added duration timer (thanks, tobekas)

Version 1.0.38
+ Thermostat: Allow minimum and maximum target temperature to be configured

Version 1.0.37
+ Added Thermostat

Version 1.0.36
+ Fix to Valve remaining duration
+ Added experimental support for RGBWWCW lights (red, green, blue, warm_white and cold_white channels)

Version 1.0.35
+ Added Valve (for Sprinkler, Shower and Faucet) - thanks, tobekas

Version 1.0.34
+ Added Air Pressure Sensor (thanks, tobekas)
+ Added Weather Station with custom Eve characteristics (thanks, tobekas)
+ Fakegato-History fix

Version 1.0.33
+ Added optional air quality sensor characteristics

Version 1.0.32
+ Added resetStateAfterms option for contact sensor, leak sensor and smoke sensor

Version 1.0.31
+ Added Eve history support for outlet power consumption (thanks, tobekas)
+ Wrap exception handling around 'apply' functions (used for encoding/decoding MQTT messages), so that errors don't crash Homebridge and messages that can't be decoded are skipped

Version 1.0.30
+ Added Elgato history support for AirQuality (thanks, sieren)
+ Extended Eve history support (thanks, tobekas)

Version 1.0.29
+ Added history support for Eve App (only) using fakegato-history. (Thanks, tobekas!)

Version 1.0.28
+ Improve behaviour of RGB, RGBW and HSV lightbulbs when not using a separate on/off topic

Version 1.0.27
+ Added ColorTemperature to Light bulb

Version 1.0.26
+ Added Window
+ Added Air Quality Sensor
+ Added Carbon Dioxide Sensor

Version 1.0.25
+ Added Lock Mechanism

Version 1.0.24
+ Added Speaker and Microphone
+ Added Window Covering (blind)

Version 1.0.23
+ Add MQTT publishing options configuration setting (`mqttPubOptions`), to allow retain flag and QoS level to be set
+ If no offValue is specified, don't publish anything when a Boolean characteristic turns off
+ When receiving a Boolean value, require configured off value to turn it off

Version 1.0.22
+ Added `startPub` configuration setting, allowing MQTT messages to be published on start-up

Version 1.0.21
+ Added InformationService to populate manufacturer and other characteristics (thanks, NorthernMan54)
+ Added Leak Sensor

Version 1.0.20
+ Added `onlineValue` configuration setting, allowing the use of a custom value to represent an online state (with `getOnline`) without the use of a custom payload decoding function.
+ Added `turnOffAfterms` support for motion sensor, allowing motion triggered by MQTT message to be self-resetting.

Version 1.0.19
+ Changed minimum temperature for temperatureSensor to -100 degrees celsius
+ Added BatteryService supporting `getBatteryLevel`, `getChargingState` and `getStatusLowBattery` for all accessories.

Version 1.0.18
+ Added `getOnline` topic to control whether an accessory should appear responsive or unresponsive

Version 1.0.17
+ Added ability to encode/decode MQTT payload using custom JavaScript functions (implemented by Michael Stürmer)

Version 1.0.16
+ Allow MQTT options to be passed directly, so that any options required can be set (not just those specifically supported by mqttthing)

Version 1.0.15
+ Allowed Garage Door and Security System target states to be modified outside of HomeKit (thanks, brefra)

Version 1.0.14
+ Added `turnOffAfterms` to items with an On characteristic like Switch, causing them to turn off automatically after a specified timeout (in milliseconds)

Version 1.0.13
+ Remove non-ASCII characters from MQTT client ID (thanks, twinkelm)

Version 1.0.12
+ Added Fan

Version 1.0.11
+ Added Light bulb option to publish RGB and RGBW values as hex
+ Added Light bulb option to publish RGB white level separately

Version 1.0.10
+ Allowed separate on/off topic when using combined "hue,saturation,value" topic with Light bulb
+ Added Light bulb combined "red,green,blue" topic support
+ Added Light bulb RGBW support through combined "red,green,blue,white" topic

Version 1.0.9
+ Added option to combine Light bulb hue (0-360), saturation (0-100) and value/brightness (0-100) into a single topic containing "hue,saturation,value"

Version 1.0.8
+ Added Stateless Programmable Switch
+ Added Garage Door Opener

Version 1.0.7
+ Fixed Smoke Sensor

Version 1.0.6
+ Added Temperature Sensor
+ Added Humidity Sensor

Version 1.0.5
+ Added Security System
+ Added Smoke Sensor

Version 1.0.4
+ Fixed Occupancy Sensor values
+ Added Doorbell

Version 1.0.3
+ Added Contact Sensor

Version 1.0.2
+ Added Light Sensor
+ Default sensors to 'active' state

Version 1.0.1
+ Initial public version with Light bulb, Switch, Outlet, Motion Sensor, Occupancy Sensor
