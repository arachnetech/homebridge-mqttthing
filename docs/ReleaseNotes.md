[![npm](https://badgen.net/npm/v/homebridge-mqttthing/latest)](https://www.npmjs.com/package/homebridge-mqttthing)
[![npm](https://badgen.net/npm/dt/homebridge-mqttthing)](https://www.npmjs.com/package/homebridge-mqttthing)
[![Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.gg/MTpeMC)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

# Homebridge MQTT-Thing: Release Notes

### Version 1.1.44
+ Fixed Swing Mode default

### Version 1.1.43
+ Enabled use with Node.js 18.12

### Version 1.1.42
+ Added speaker service to implement Homekit set for volume buttons (thanks, tukaloff)
+ Added characteristic_Active to thermostat (thanks, nicknicknickos)
+ Added dehumidifier (thanks, rcaceiro)

### Version 1.1.41
+ Added extendedTopic info to codec calls (thanks, Flavio De Stefano)

### Version 1.1.40
+ Added configurable minimum and maximum voltage for outlet (minVolts, maxVolts)

### Version 1.1.39
+ Fix RGB light validation errors (issue #510)

### Version 1.1.38
+ Fix to use valid initial value for airPressure (0 invalid)

### Version 1.1.37
+ Update to MQTT 4.3.2
+ Fixed characteristic_TemperatureDisplayUnits for airQualitySensor

### Version 1.1.36
+ Miscellaneous fixes to pull requests merged in version 1.1.33

### Version 1.1.35
+ Added support for MQTTTHING_ environment variables providing default MQTT settings (thanks, Robert Redgwell)

### Version 1.1.34
+ Added Door
+ Add minimum and maximum position for window, door and windowCovering

### Version 1.1.33
+ Revert change in 1.1.32. MQTT-Thing now requires Node.js 14 or later.
+ Engines updated to require Homebridge 1.3.5 and Node.js 14 (thanks, Donavan Becker)
+ Fixed typo in documentation (thanks, Brian White)
+ Fixed duration characteristic validation error message (thanks, Thomas Vandahl)
+ Moved codec loading earlier to allow codecs to manipulate the configuration (thanks, Martin)
+ Added water level characteristic to leak sensor (thanks, Moritz)
+ Added max wind and dewpoint characteristics to weather station (thanks, 2610)
+ Added jsonpath support (thanks, Antonio Yip)
+ Added Eve Room 2 support for air quality sensor (thanks, D4rk)
+ Don't set MQTT retain in example config (thanks, iGod42)
+ Added AltSensorState to alarm system (thanks, Ferme de Pommerieux)
+ Added codec for Bosch AMAX with Shelly switches (thanks, Ferme de Pommerieux)

### Version 1.1.32
+ Improve compatibility with older Node.js versions

### Version 1.1.31
+ Improve null handling (multicharacteristic) (thanks, Jakub Samek)
+ Added optimizePublishing option

### Version 1.1.30
+ Fixed out of range default voltage
+ Validation tweaks

### Version 1.1.29
+ Update Node.js dependencies - homebridge-lib now requires Node.js 14 

### Version 1.1.28
+ Validation fixes
+ Allow validation to be disabled

### Version 1.1.27
+ Added support for adaptive lighting

### Version 1.1.26 (Beta)
+ Weather Station: added ambient light level (thanks, Matt Kirman)
+ Validate characteristics when setting to avoid Homebridge 1.3 warnings
+ Lock/unlock fix with Siri and Homebridge 1.3.x (thanks, @tasict)

### Version 1.1.25
+ Fan: When setRotationSpeed is configured but not setOn, turn fan off with zero rotation speed (https://github.com/arachnetech/homebridge-mqttthing/issues/358 and https://github.com/arachnetech/homebridge-mqttthing/issues/310)
+ Lightbulb: Change `whiteMix` to `noWhiteMix` for configuration schema as items defaulting to true are populated when irrelevant
+ Fan: Tested minRotationSpeed/maxRotationSpeed - Homekit apparently doesn't like this changed
+ Added debounceRecvms setting

### Version 1.1.24
+ Lightbulb: Allow lightbulb-Dimmable to use setBrightness only (0 brightness for off) when no setOn topic configured

### Version 1.1.23
+ Thermostat: Fixed target relative humidity
+ Changed incorrect 'http' protocol in MQTT server configuration to 'mqtt' (thanks, Nicholas Humfrey)

### Version 1.1.22
+ Light: Added redThreshold, greenThreshold, blueThreshold for when whiteMix is false in an RGBWW light
+ Light: Added minColorTemperature and maxColorTemperature configuration settings
+ Light: Added switchWhites setting for RGBWW light

### Version 1.1.21
+ Updated fakegato-history dependency version
+ Added whiteMix option to configuration schema
+ Fixed publishing confirmation with Boolean values (https://github.com/arachnetech/homebridge-mqttthing/issues/363)

### Version 1.1.20
+ Added insecure option for TLS, disabling checking of certificate and server identity

### Version 1.1.19
+ Allowed TLS certificate, key and ca pem files to be loaded

### Version 1.1.18
+ Added whiteMix option for RGBWW lights. Set whiteMix to false to disable extraction of white components from colours - i.e. powering only RGB channels or WW,CW channels. (https://github.com/arachnetech/homebridge-mqttthing/issues/300)

### Version 1.1.17 (TEST BUILD)
+ Added support for grouped (custom) accessories (https://github.com/arachnetech/homebridge-mqttthing/issues/201)

### Version 1.1.16
+ Changed order of Codec and apply() used together so that on publishing values pass through apply function before codec, and on subscription values pass through codec before apply function. This allows manipulation of values like the red,green,blue string from the RGB light before codec encoding and after codec decoding. This makes the JSON codec more flexible.

### Version 1.1.15
+ Fixed weather station with homebridge-lib 4.7.7

### Version 1.1.14
+ Added air purifier (implemented by @tobekas)
+ Added irrigation system (implemented by @tobekas)
+ JSON codec: added per-topic fixed values and retain option

### Version 1.1.13
+ When using missing confirmation to set offline state, any message received after timeout sets state back to online
+ Added internal codec concept: specifying a codec with no .js suffix will load it from the mqttthing 'codecs' directory
+ Added experimental JSON codec (json)
+ RGB and HSV lights: wait for multiple property changes before publishing

### Version 1.1.12
+ Extended codecs to support ad hoc property changes and MQTT publishing
+ Codec defaults changed to apply per-function

### Version 1.1.11
+ Fixed publishing of empty messages configured through config-ui-x in startPub (#253)

### Version 1.1.10
+ Fixed crash (introduced in version 1.1.9) with confirmed publisher on/off acknowledgement (#252)

### Version 1.1.9
+ Added persistencePath to historyOptions
+ Added support for codecs
+ Added state to apply functions

### Version 1.1.8
+ Garage door add getDoorMoving option as simpler alternative to getCurrentDoorState
+ Changed default garage door state (after restart) to closed

### Version 1.1.7
+ Allow temperature sensor current temperature range to be overriden (using minTemperature and maxTemperature)
+ Added confirmationIndicateOffline option
+ Moved history options from history to historyOptions object
+ Added config-ui-x support for historyOptions

### Version 1.1.6
+ Added history support for switch (implemented by @tobekas)
+ Fixed #223 and #207 - history not working if getTotalConsumption used (implemented by @tobekas)
+ Fixed history last activation in motion and contact sensor (implemented by @tobekas)
+ Allowed config.url string without protocol, now defaulting to mqtt:// (implemented by @tobekas)

### Version 1.1.5
+ Don't throw an exception at start-up if the configuration is invalid (as this stops Homebridge unnecessarily)

### Version 1.1.4
+ Fixed excessive MQTT logging (introduced in 1.1.2). Thanks, @nzbullet.

### Version 1.1.3
+ Added lightbulb sub-types to configuration schema, allowing easier configuration of different lightbulb types.
+ Added missing otherValueOff to configuration schema.

### Version 1.1.2
+ Added configuration schema, supporting configuration of most settings through config-ui-x (thanks, @oznu). Note that 'apply' functions are not supported.
+ Added new 'startPub' format, allowing configuration through config-ui-x.

### Version 1.1.1
+ Changed Boolean value handling to support bare JavaScript Booleans returned from incoming MQTT apply() functions (`"true" != true` but both are now accepted).
+ Boolean property values passed to outgoing MQTT apply() functions are no-longer converted to strings first (for consistency with the change above). This allows easier publishing of JSON containing correctly typed values, but **may change outgoing message format with existing configurations in some situations**.
+ Added option to configure garage door target values independently of current values - thanks, Charles Powell

### Version 1.0.50
+ Stateless Programmable Switch: allow multiple buttons under a single switch - thanks, Jacob Nite

### Version 1.0.49
+ Stateless Programmable Switch: added option to restrict available switch values - thanks, Jacob Nite

### Version 1.0.48
+ Upgrade to latest homebridge-lib (4.4.10 or later)

### Version 1.0.47
+ Fix: latest homebridge-lib (introduced in last build) appears incompatible with our references to Eve.Characteristic (e.g. Eve.Characteristic.CurrentConsumption)

### Version 1.0.46
+ Suppress logging of MQTT password (issue #150)

### Version 1.0.45
+ Allow changing of default run time (duration) range for valve

### Version 1.0.44
+ Added HeaterCooler

### Version 1.0.43
+ Added option to treat unrecognized received on/off values as off when an explicit off value is configured
+ Security System: Allow target states to be restricted

### Version 1.0.42
+ Added publishing confirmation (`setOn` message must be echoed to `getOn` topic to confirm that it has been processed by the accessory), with automatic republishing
+ Added Television (implemented by tobekas)
+ Fix to characteristics with multiple states (thanks, tobekas)

### Version 1.0.41
+ Light: Add option to control dimmable white light through integer in range 0-255, so that one channel of an RGB or RGBW controller can be used more easily for a white light

### Version 1.0.40
+ Thermostat: Allow target heating/cooling states to be restricted

### Version 1.0.39
+ Valve: Added duration timer (implemented by tobekas)

### Version 1.0.38
+ Thermostat: Allow minimum and maximum target temperature to be configured

### Version 1.0.37
+ Added Thermostat

### Version 1.0.36
+ Fix to Valve remaining duration
+ Added experimental support for RGBWWCW lights (red, green, blue, warm_white and cold_white channels)

### Version 1.0.35
+ Added Valve (for Sprinkler, Shower and Faucet) - implemented by tobekas

### Version 1.0.34
+ Added Air Pressure Sensor (implemented by tobekas)
+ Added Weather Station with custom Eve characteristics (implemented by tobekas)
+ Fakegato-History fix

### Version 1.0.33
+ Added optional air quality sensor characteristics

### Version 1.0.32
+ Added resetStateAfterms option for contact sensor, leak sensor and smoke sensor

### Version 1.0.31
+ Added Eve history support for outlet power consumption (implemented by tobekas)
+ Wrap exception handling around 'apply' functions (used for encoding/decoding MQTT messages), so that errors don't crash Homebridge and messages that can't be decoded are skipped

### Version 1.0.30
+ Added Elgato history support for AirQuality (thanks, sieren)
+ Extended Eve history support (implemented by tobekas)

### Version 1.0.29
+ Added history support for Eve App (only) using fakegato-history (implemented by tobekas)

### Version 1.0.28
+ Improve behaviour of RGB, RGBW and HSV lightbulbs when not using a separate on/off topic

### Version 1.0.27
+ Added ColorTemperature to Light bulb

### Version 1.0.26
+ Added Window
+ Added Air Quality Sensor
+ Added Carbon Dioxide Sensor

### Version 1.0.25
+ Added Lock Mechanism

### Version 1.0.24
+ Added Speaker and Microphone
+ Added Window Covering (blind)

### Version 1.0.23
+ Add MQTT publishing options configuration setting (`mqttPubOptions`), to allow retain flag and QoS level to be set
+ If no offValue is specified, don't publish anything when a Boolean characteristic turns off
+ When receiving a Boolean value, require configured off value to turn it off

### Version 1.0.22
+ Added `startPub` configuration setting, allowing MQTT messages to be published on start-up

### Version 1.0.21
+ Added InformationService to populate manufacturer and other characteristics (thanks, NorthernMan54)
+ Added Leak Sensor

### Version 1.0.20
+ Added `onlineValue` configuration setting, allowing the use of a custom value to represent an online state (with `getOnline`) without the use of a custom payload decoding function.
+ Added `turnOffAfterms` support for motion sensor, allowing motion triggered by MQTT message to be self-resetting.

### Version 1.0.19
+ Changed minimum temperature for temperatureSensor to -100 degrees celsius
+ Added BatteryService supporting `getBatteryLevel`, `getChargingState` and `getStatusLowBattery` for all accessories.

### Version 1.0.18
+ Added `getOnline` topic to control whether an accessory should appear responsive or unresponsive

### Version 1.0.17
+ Added ability to encode/decode MQTT payload using custom JavaScript functions (implemented by Michael Stürmer)

### Version 1.0.16
+ Allow MQTT options to be passed directly, so that any options required can be set (not just those specifically supported by mqttthing)

### Version 1.0.15
+ Allowed Garage Door and Security System target states to be modified outside of HomeKit (thanks, brefra)

### Version 1.0.14
+ Added `turnOffAfterms` to items with an On characteristic like Switch, causing them to turn off automatically after a specified timeout (in milliseconds)

### Version 1.0.13
+ Remove non-ASCII characters from MQTT client ID (thanks, twinkelm)

### Version 1.0.12
+ Added Fan

### Version 1.0.11
+ Added Light bulb option to publish RGB and RGBW values as hex
+ Added Light bulb option to publish RGB white level separately

### Version 1.0.10
+ Allowed separate on/off topic when using combined "hue,saturation,value" topic with Light bulb
+ Added Light bulb combined "red,green,blue" topic support
+ Added Light bulb RGBW support through combined "red,green,blue,white" topic

### Version 1.0.9
+ Added option to combine Light bulb hue (0-360), saturation (0-100) and value/brightness (0-100) into a single topic containing "hue,saturation,value"

### Version 1.0.8
+ Added Stateless Programmable Switch
+ Added Garage Door Opener

### Version 1.0.7
+ Fixed Smoke Sensor

### Version 1.0.6
+ Added Temperature Sensor
+ Added Humidity Sensor

### Version 1.0.5
+ Added Security System
+ Added Smoke Sensor

### Version 1.0.4
+ Fixed Occupancy Sensor values
+ Added Doorbell

### Version 1.0.3
+ Added Contact Sensor

### Version 1.0.2
+ Added Light Sensor
+ Default sensors to 'active' state

### Version 1.0.1
+ Initial public version with Light bulb, Switch, Outlet, Motion Sensor, Occupancy Sensor
