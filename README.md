# homebridge-mqttthing
Homebridge plugin supporting various services over MQTT, originally based on homebrige-mqttswitch and homebridge-mqttlightbulb

   * [Installation](#installation)
   * [Configuration](#configuration)
   * [Supported Accessories](#supported-accessories)
   * [Release notes](#release-notes)

# Installation
Follow the instructions in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
This plugin is published through [NPM](https://www.npmjs.com/package/homebridge-mqttthing) and should be installed "globally" by typing:

    npm install -g homebridge-mqttthing

# Configuration
Configure the plugin in your homebridge config.json file.

Note that setXxx topics are published by Homebridge and should be subscribed-to by devices, and getXxx topics are published by devices to provide feedback on state to Homebridge.

Various different service types are supported by this single 'mqttthing' accessory...

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
    "mqttOptions": { keepalive: 30 },
    "mqttPubOptions": { retain: true },
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
    "chargingStateValues": [ "NotCharging", "Charging", "NotChargeable" ],
    "startPub": {
        "topic1": "message1",
        "topic2": "message2"
    }
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
 
`mqttPubOptions` - Option containin any MQTT publishing options required. See https://www.npmjs.com/package/mqtt#publish for details.

`logMqtt` - Set to true to enable MQTT logging for this accessory (optional, defaults to false)

### MQTT Topics

`getName` - Topic that may be published to send HomeKit the name of the accessory (optional)

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

### Boolean Value Settings

Homekit Boolean types like on/off use strings "true" and "false" in MQTT messages unless `"integerValue": true` is configured, in which case they use to "1" and "0". Alternatively, specific values can be configured using `onValue` and `offValue` (in which case `integerValue` is ignored). Other Homekit types (integer, string, etc.) are not affected by these settings.

`integerValue` - set to **true** to use the values **1** and **0** to represent Boolean values instead of the strings **"true"** and **"false"** (optional, defaults to false)

`onValue` - configure a specific Boolean true or *on* value (optional)

`offValue` - configure a specific Boolean false or *off* value (optional)

`onlineValue` - configure a specific value representing that an accessory is online (received through `getOnline`). If not specified, the configured *on* value will be used to represent an online state (i.e. `onValue` if configured, otherwise **1** with `integerValue: true` or **true** with `integerValue: false`).

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

MQTT messages may be published on start-up, e.g. to reset accessories to a known initial state, with `startPub`. This is an object containing MQTT topics as keys, and values to be published as values.

# Supported Accessories

   * [Tested Configurations](#Tested-Configurations)
   * [Contact Sensor](#contact-sensor)
   * [Doorbell](#doorbell)
   * [Fan](#fan)
   * [Garage door opener](#garage-door-opener)
   * [Humidity Sensor](#humidity-sensor)
   * [Leak Sensor](#leak-sensor)
   * [Light bulb](#light-bulb)
   * [Light Sensor](#light-sensor)
   * [Microphone](#microphone)
   * [Motion Sensor](#motion-sensor)
   * [Occupancy Sensor](#occupancy-sensor)
   * [Outlet](#outlet)
   * [Security System](#security-system)
   * [Speaker](#speaker)
   * [StatelessProgrammableSwitch](#statelessprogrammableswitch)
   * [Switch](#switch)
   * [Temperature Sensor](#temperature-sensor)
   * [Window Covering (Blinds)](#window-covering)
   
## Tested Configurations

Tested and working configurations for devices are available on the [Wiki](https://github.com/arachnetech/homebridge-mqttthing/wiki/Tested-Configurations).  Please add your working configurations for others.

## Contact Sensor

Contact sensor state is exposed as a Boolean. True (or 1 with integer values) maps to `CONTACT_NOT_DETECTED` (sensor triggered)
and False (or 0) maps to `CONTACT_DETECTED` (not triggered). To use different MQTT values, configure `onValue` and `offValue`.

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
        "getContactSensorState": "<topic used to provide contact sensor state>"
        "getStatusActive":       "<topic used to provide 'active' status (optional)>",
        "getStatusFault":        "<topic used to provide 'fault' status (optional)>",
        "getStatusTampered":     "<topic used to provide 'tampered' status (optional)>",
        "getStatusLowBattery":   "<topic used to provide 'low battery' status (optional)>"
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>"
}
```


## Doorbell

Doorbell ring switch state can be be `SINGLE_PRESS`, `DOUBLE_PRESS` or `LONG_PRESS`. By default, these events are raised when values of `1`, `2` and `L` respectively are published to the **getSwitch** topic. However, these values may be overridden by specifying an alternative array in the **switchValues** setting.

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
    "turnOffAfterms": <milliseconds after which to turn off automatically (optional)>
}
```


## Garage Door Opener

Garage door opener current door state can be **OPEN**, **CLOSED**, **OPENING**, **CLOSING**, **STOPPED**. By default, these use values of `O`, `C`, `o`, `c` and `S` respectively; these defaults can be changed using the **doorValues** setting.

Garage door opener target state can be **OPEN** or **CLOSED**. By default, values of `O` and `C` are used respectively (unless changed through **doorValues**).

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
        "getTargetDoorState":       "test/garage/current",
        "getCurrentDoorState":      "test/garage/current",
        "setLockTargetState":       "test/garagelock/target",
        "getLockTargetState":       "test/garagelock/current",
        "getLockCurrentState":      "test/garagelock/current",
        "getObstructionDetected":   "test/garage/obstruction"
    },
    "doorValues": [ "Open", "Closed", "Opening", "Closing", "Stopped" ],
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

`lockValues` - Array of 4 lock values corresponding to unsecured, secured, jammed and unknown respectively. if not specified, defaults to `[ 'U', 'S', 'J', '?' ]`.

`integerValue` - Set to true to use values 1 and 0 instead of "true" and "false" respectively for obstruction detected value.


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
    }
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
    }
}
```


## Light bulb

Light bulb can either use separate topics (for on, brightness, hue and saturation), or it can be configured to use a combined value holding comma-separated hue,sat,val or red,green,blue. 

Hue is 0-360. Saturation is 0-100. Brightness is 0-100. Red, green and blue are 0-255.

If `topics.setHSV` is populated, a combined value is used and any individual brightness, hue and saturation topics are ignored. On/off is sent with `setOn` if configured, or by setting V to 0 when off.

If `topics.setRGB` is populated, a combined value is used in the format red,green,blue (ranging from 0-255). On/off may be sent with `setOn`; brightness, hue and saturation topics are ignored. If `topics.setWhite` is also populated, the white level is extracted and sent separately to the combined RGB value.

If `topics.setRGBW` is populated, a combined value is used in the format red,green,blue,white (ranging from 0-255). On/off may be set with `setOn`; brightness, hue and saturation topics are ignored.

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
        "getWhite":         "<topic to get white level (0-255)> - used with getRGB for RGBW with separately-published white level",
        "setWhite":         "<topic to set white level (0-255)> - used with setRGB for RGBW with separately-published white level",
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>",
    "hex": "true to format combined RGB/RGBW in hexadecimal instead of as comma-separated decimals",
    "hexPrefix": "format combined RGB/RGBW in hexadecimal with specified prefix (typically '#') instead of as comma-separated decimals",
    "turnOffAfterms": <milliseconds after which to turn off automatically (optional)>
}
```


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
    "offValue": "<value representing off (optional)>"
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
        "getOn":            "<topic to get the status>",
        "setOn":            "<topic to set the status>",
        "getInUse":         "<topic used to provide 'outlet is in use' feedback>"
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>",
    "turnOffAfterms": <milliseconds after which to turn off automatically (optional)>
}
```


## Security System

Security System current state can be **STAY_ARM**, **AWAY_ARM**, **NIGHT_ARM**, **DISARMED** or **ALARM_TRIGGERED**. By default, these events are raised when values of `SA`, `AA`, `NA`, `D` and `T` respectively are published to the **getCurrentState** topic. However, these values may be overriden by specifying an alternative array in the **currentStateValues** setting.

Security System target state can be **STAY_ARM**, **AWAY_ARM**, **NIGHT_ARM** or **DISARM**. By default, these states correspond to values of `SA`, `AA`, `NA` and `D`. Homebridge expects to control the target state (causing one of these values to be published to the **setTargetState** topic), and to receive confirmation from the security system that the state has been achieved through a change in the current state (received through the **getCurrentState** topic). The values used for target state can be specified as an an array in the **targetStateValues** setting.

Homebridge publishes a value to the **getCurrentState** topic to indicate the state that the HomeKit users wishes the alarm to be in. The alarm system must echo this state back to the **setCurrentState** topic to confirm that it has set the alarm state appropriately. The alarm system may also publish the ALARM_TRIGGERED value (`T` by default) to the **setCurrentState** topic in order to indicate that the alarm has been triggered. If the alarm system publishes any other states to the **setCurrentState** topic, HomeKit will wait for it to return to the user's target state; in other words, only the HomeKit user can control the arming state of the alarm, not the alarm system itself.

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
    "currentStateValues": [ "StayArm", "AwayArm", "NightArm", "Disarmed", "Triggered" ]
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
    "offValue": "<value representing off (optional)>"
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
}
```


## Switch

On/off switch.

Configuring `turnOffAfter` causes the switch to turn off automatically the specified number of milliseconds after it is turned on.

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
    "turnOffAfterms": <milliseconds after which to turn off automatically (optional)>
}
```


## Temperature Sensor

Current temperature must be in the range 0 to 100 degrees Celsius to a maximum of 1dp.

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
    }
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
        "getCurrentVerticalTiltAngle":   "<topic used to report current vertical tilt angle>"
    },
    "positionStateValues": [ "decreasing-value", "increasing-value", "stopped-value" ]
}
```


# Release notes

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
