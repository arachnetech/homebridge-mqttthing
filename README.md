[![npm](https://badgen.net/npm/v/homebridge-mqttthing/latest)](https://www.npmjs.com/package/homebridge-mqttthing)
[![npm](https://badgen.net/npm/dt/homebridge-mqttthing)](https://www.npmjs.com/package/homebridge-mqttthing)
[![Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.gg/MTpeMC)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

# Homebridge MQTT-Thing
[Homebridge MQTT-Thing](https://www.npmjs.com/package/homebridge-mqttthing) is a plugin for [Homebridge](https://github.com/homebridge/homebridge) allowing the integration of [many different accessory types](#supported-accessories) using MQTT.

   * [Installation](#installation)
   * [Configuration](#configuration)
   * [Supported Accessories](#supported-accessories)
   * [Release notes](docs/ReleaseNotes.md)

## Compatibility with previous versions

**From version 1.1.x, raw JavaScript values for Boolean properties are passed to MQTT apply functions.** This may change published message formats, e.g. when apply functions are used to build JSON strings.

For full details of changes please see the [Release notes](docs/ReleaseNotes.md).

## Installation
Follow the instructions in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
This plugin is published through [NPM](https://www.npmjs.com/package/homebridge-mqttthing) and should be installed "globally" by typing:

    npm install -g homebridge-mqttthing

Installation through 
[Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x) is also supported (and recommended).

## Configuration
Configure the plugin in your homebridge `config.json` file. Most configuration settings can now also be entered using 
[Homebridge Config UI X](https://www.npmjs.com/package/homebridge-config-ui-x).

MQTT topics used fall into two categories:

   * Control topics, of the form `setXXX`, are published by MQTT-Thing in order to control device state (e.g. to turn on a light).
   * Status/notification topics, of the form `getXXX`, are published by the device to notify MQTT-Thing that something has occurred (e.g. that a sensor has detected something or a control topic action has been performed).

For further details, see [docs/Configuration.md](docs/Configuration.md) and [docs/Codecs.md](docs/Codecs.md).

## Supported Accessories

The following Homekit accessory types are supported by MQTT-Thing:

   * [Air Pressure Sensor](docs/Accessories.md#air-pressure-sensor)
   * [Air Quality Sensor](docs/Accessories.md#air-quality-sensor)
   * [Carbon Dioxide Sensor](docs/Accessories.md#carbon-dioxide-sensor)
   * [Contact Sensor](docs/Accessories.md#contact-sensor)
   * [Doorbell](docs/Accessories.md#doorbell)
   * [Fan](docs/Accessories.md#fan)
   * [Garage door opener](docs/Accessories.md#garage-door-opener)
   * [Heater Cooler](docs/Accessories.md#heater-cooler)
   * [Humidity Sensor](docs/Accessories.md#humidity-sensor)
   * [Leak Sensor](docs/Accessories.md#leak-sensor)
   * [Light bulb](docs/Accessories.md#light-bulb)
   * [Light Sensor](docs/Accessories.md#light-sensor)
   * [Lock Mechanism](docs/Accessories.md#lock-mechanism)
   * [Microphone](docs/Accessories.md#microphone)
   * [Motion Sensor](docs/Accessories.md#motion-sensor)
   * [Occupancy Sensor](docs/Accessories.md#occupancy-sensor)
   * [Outlet](docs/Accessories.md#outlet)
   * [Security System](docs/Accessories.md#security-system)
   * [Speaker](docs/Accessories.md#speaker)
   * [StatelessProgrammableSwitch](docs/Accessories.md#statelessprogrammableswitch)
   * [Switch](docs/Accessories.md#switch)
   * [Television](docs/Accessories.md#television)
   * [Temperature Sensor](docs/Accessories.md#temperature-sensor)
   * [Thermostat](docs/Accessories.md#thermostat)
   * [Valve (Sprinkler, Shower, Faucet)](docs/Accessories.md#valve)
   * [Weather Station](docs/Accessories.md#weather-station)
   * [Window](docs/Accessories.md#window)
   * [Window Covering (Blinds)](docs/Accessories.md#window-covering)
   
## Tested Configurations

Tested and working configurations for devices are available on the [Wiki](https://github.com/arachnetech/homebridge-mqttthing/wiki/Tested-Configurations).  Please add your working configurations for others.
