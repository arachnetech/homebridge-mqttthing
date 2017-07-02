# homebridge-mqttthing
A Homebridge plugin for a simple simple services, based on homebrige-mqttswitch and homebridge-mqttlightbulb

# Installation
Follow the instruction in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
This plugin will be published through NPM...

# Configuration
Configure the plugin in your homebridge config.json file.

Note that setXxx topics are published by Homebridge and should be subscribed-to by devices, and getXxx topics are published by devices to provide feedback on state to Homebridge.

Various different service types are supported by this single 'mqttthing' accessory...

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
        "getOn": 	        "<topic to get the status>",
        "setOn": 	        "<topic to set the status>",
        "getInUse":         "<topic used to provide 'outlet is in use' feedback>"
    },
    "integerValue": "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue": "<value representing on (optional)>",
    "offValue": "<value representing off (optional)>"
}
```
