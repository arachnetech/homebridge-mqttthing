# homebridge-mqttthing
A Homebridge plugin for a simple simple services, based on homebrige-mqttswitch and homebridge-mqttlightbulb

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
+ Added SecuritySystem

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


## Light bulb
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
        "setSaturation": 	"<topic to set the saturation (optional - if coloured)>"
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>"
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
        "getSwitch":        "<topic used to provide doorbell switch state>"
        "getBrightness":    "<topic used to get brightness (optional)>",
        "setBrightness":    "<topic used to set brightness (optional)>",
        "getVolume":        "<topic used to get volume (optional)>",
        "setVolume":        "<topic used to set volume (optional)>"
    },
    "switchValues": "<array of 3 switch values corresponding to single-press, double-press and long-press respectively (optional)>"
}
```
