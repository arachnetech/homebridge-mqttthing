# homebridge-mqttthing
A Homebridge plugin for several services, based on homebrige-mqttswitch and homebridge-mqttlightbulb

# Installation
Follow the instructions in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
This plugin is published through [NPM](https://www.npmjs.com/package/homebridge-mqttthing) and should be installed "globally" by typing:

    npm install -g homebridge-mqttthing

# Release notes
Version 1.0.1
+ Initial public version with Light bulb, Switch, Outlet, Motion Sensor, Occupancy Sensor

Version 1.0.2
+ Added Light Sensor
+ Default sensors to 'active' state

Version 1.0.3
+ Added Contact Sensor

Version 1.0.4
+ Fixed Occupancy Sensor values
+ Added Doorbell

Version 1.0.5
+ Added Security System
+ Added Smoke Sensor

Version 1.0.6
+ Added Temperature Sensor
+ Added Humidity Sensor

Version 1.0.7
+ Fixed Smoke Sensor

Version 1.0.8
+ Added Stateless Programmable Switch
+ Added Garage Door Opener

Version 1.0.9
+ Added option to combine Light bulb hue (0-360), saturation (0-100) and value/brightness (0-100) into a single topic containing "hue,saturation,value"

Version 1.0.10
+ Allow separate on/off topic when using combined hue,saturation,value topic with light bulb
+ Add combined red,green,blue topic support for light bulb


# Configuration
Configure the plugin in your homebridge config.json file.

Note that setXxx topics are published by Homebridge and should be subscribed-to by devices, and getXxx topics are published by devices to provide feedback on state to Homebridge.

Various different service types are supported by this single 'mqttthing' accessory...

## Common settings

The following settings apply to all device types:

```javascript
{
    "accessory": "mqttthing",
    "type": "<type of thing - supported types are described in the following sections>",
    "name": "<name of thing>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "caption": "<label (optional)>",
    "logMqtt": "true to enable logging of MQTT messages sent and received for this accessory",
    "topics":
    {
        "getName": 	        "<topic to get the name>"
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>"
}
```

Boolean types like on/off use  true/false unless `integerValue: true` is configured, in which case they default to 1/0. Alternatively, specific values can be configured using `onValue` and `offValue`. Integer and string types are not affected by these settings.


# Supported Accessories

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


## Garage Door Opener

Garage door opener current door state can be `OPEN`, `CLOSED`, `OPENING`, `CLOSING`, `STOPPED`. By default, these use values of `O`, `C`, `o`, `c` and `S` respectively; these defaults can be changed using the **doorValues** setting.

Garage door opener target state can be `OPEN` or `CLOSED`. By default, values of `0` and `1` are used respectively (unless changed through **doorValues**).

Lock current state can be `UNSECURED`, `SECURED`, `JAMMED` or `UNKNOWN`. By default, these use values of `U`, `S`, `J`, `?` respectively; these can be changed using the **lockValues** setting.

Lock target state can be `UNSECURED` or `SECURED`. By default, these use values of `U` and `S` respectively (unless changed through **lockValues**).

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
        "getCurrentDoorState":      "<topic used to get current door state>",
        "setTargetDoorState":       "<topic used to set target door state>",
        "getObstructionDetected":   "<topic used to get obstruction detected state>",
        "getLockCurrentState":      "<topic used to get lock current state (optional)>",
        "setLockTargetState":       "<topic used to set lock current state (optional)>"
    },
    "doorValues": "<array of 5 door values corresponding to open, closed, opening, closing and stopped respectively (optional)>",
    "lockValues": "<array of 4 lock values corresponding to unsecured, secured, jammed and unknown respectively (optional)>",
    "integerValue": "true to use 1|0 instead of true|false for obstruction detected value"
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
    }
}
```


## Light bulb

Light bulb can either use separate topics (for on, brightness, hue and saturation), or it can be configured to use a combined value holding comma-separated hue,sat,val or red,green,blue. 

Hue is 0-360. Saturation is 0-100. Brightness is 0-100. Red, green and blue are 0-255.

If `topics.setHSV` is populated, a combined value is used and any individual brightness, hue and saturation topics are ignored. On/off is sent with `setOn` if configured, or by setting V to 0 when off.

If `topics.setRGB` is populated, a combined value is used in the format red,green,blue (ranging from 0-255). On/off may be sent with `setOn`; brightness, hue and saturation topics are ignored.

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
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>"
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
    "offValue": "<value representing off (optional)>"
}
```


## Security System

Security System current state can be `STAY_ARM`, `AWAY_ARM`, `NIGHT_ARM`, `DISARMED` or `ALARM_TRIGGERED`. By default, these events are raised when values of `SA`, `AA`, `NA`, `D` and `T` respectively are published to the **getCurrentState** topic. However, these values may be overriden by specifying an alternative array in the **currentStateValues** setting.

Security System target state can be `STAY_ARM`, `AWAY_ARM`, `NIGHT_ARM` or `DISARM`. By default, these states correspond to values of `SA`, `AA`, `NA` and `D`. Homebridge expects to control the target state (causing one of these values to be published to the **setTargetState** topic), and to receive confirmation from the security system that the state has been achieved through a change in the current state (received through the **getCurrentState** topic). The values used for target state can be specified as an an array in the **targetStateValues** setting.

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
    "topics":
    {
        "getCurrentState":    "<topic used to get security system current state>",
        "setTargetState":     "<topic used to set security system target state>"
    },
    "currentStateValues": "<array of 5 values corresponding to security system current states (optional)>",
    "targetStateValues": "<array of 4 values corresponding to security system target states (optional)>"
}
```

## Smoke Sensor

Contact sensor state is exposed as a Boolean. True (or 1 with integer values) maps to `SMOKE_DETECTED` 
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
        "getSmokeDetected":      "<topic used to provide contact sensor state>"
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
    "offValue": "<value representing off (optional)>"
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
