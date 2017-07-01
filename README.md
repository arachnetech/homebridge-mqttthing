# homebridge-mqttthing
A Homebridge plugin for a simple simple services, based on homebrige-mqtt-switch and homebridge-mqttlightbulb

# Installation
Follow the instruction in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
This plugin will be published through NPM...

# Configuration
Configure the plugin in your homebridge config.json file.

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
    "caption": "<label> (optional)>",
    "topics":
    {
        "getOn": 	        "<topic to get the status>",
        "setOn": 	        "<topic to set the status>",
        "getBrightness": 	"<topic to get the brightness (optional)>",
        "setBrightness": 	"<topic to set the brightness> (optional - if dimmable)",
        "getHue": 	        "<topic to get the hue (optional)>",
        "setHue": 	        "<topic to set the hue> (optional - if coloured)",
        "getSaturation": 	"<topic to get the saturation> (optional)",
        "setSaturation": 	"<topic to set the saturation> (optional - if coloured)"
    }
}
```
