[![npm](https://badgen.net/npm/v/homebridge-mqttthing/latest)](https://www.npmjs.com/package/homebridge-mqttthing)
[![npm](https://badgen.net/npm/dt/homebridge-mqttthing)](https://www.npmjs.com/package/homebridge-mqttthing)
[![Discord](https://img.shields.io/discord/432663330281226270?color=728ED5&logo=discord&label=discord)](https://discord.gg/MTpeMC)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

# Homebridge MQTT-Thing: Supported Accessories

The following Homekit accessory types are supported by MQTT-Thing:

   * [Air Pressure Sensor](#air-pressure-sensor)
   * [Air Purifier](#air-purifier)
   * [Air Quality Sensor](#air-quality-sensor)
   * [Carbon Dioxide Sensor](#carbon-dioxide-sensor)
   * [Contact Sensor](#contact-sensor)
   * [Doorbell](#doorbell)
   * [Fan](#fan)
   * [Garage door opener](#garage-door-opener)
   * [Heater Cooler](#heater-cooler)
   * [Humidity Sensor](#humidity-sensor)
   * [Irrigation System](#irrigation-system)
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

For general details on configuration, please see [Configuration.md](Configuration.md).

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


## Air Purifier

Active state is set with a boolean value (see [Boolean Value Settings](../docs/Configuration.md#boolean-value-settings)).

Target air purifier state can be **MANUAL** or **AUTO**. To use different values, specify an array of strings in **targetAirPurifierStateValues**. (*Note: Apple's Home App will apparently set the target air purifier state to **AUTO** when the device is activated.*)

Current air purifier state can be **INACTIVE**, **IDLE** or **PURIFYING**. To use different values, specify an array of strings in **currentAirPurifierStateValues**. **INACTIVE** should be used in response if "Active" is set to false. **IDLE** or **PURIFYING** should be used in response if "Active" is set to true.

Lock physical controls state may be **DISABLED** or **ENABLED**. To use different values, specify an array of strings in **lockPhysicalControlsValues**.

Swing mode state may be **DISABLED** or **ENABLED**. To use different values, specify an array of strings in **swingModeValues**.

The filter life level is used to indicate remaining filter life level in percent. The value should be a integer between 0 and 100 with no decimal places. Related to this is the filter change indication which is used to indicate if it is time to replace the filter. It is a boolean value and true indicates that a replacement is needed. After a filter replacement this should be set to false. If the hardware device does not have a way to indicate that the filter has been replaced, the reset filter indication can be used. It is currently only supported in the Eve app. When triggered (by the user after a filter change), the MQTT device should reset FilterChangeIndication to false and FilterLifeTime to 100.

```javascript
{
    "accessory": "mqttthing",
    "type": "airPurifier",
    "name": "<name of device>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "logMqtt": true | false,
    "topics": {
        "setActive":                    "<topic used to control 'active' state>",
        "getActive":                    "<topic used to report 'active' state>",
        "getCurrentAirPurifierState":   "<topic used to report 'current air purifier state'>",
        "setTargetAirPurifierState":    "<topic used to control 'target air purifier state'>",
        "getTargetAirPurifierState":    "<topic used to report 'target air purifier state'>",
        "setRotationSpeed":             "<topic used to control 'rotation speed' (optional)>",
        "getRotationSpeed":             "<topic used to report 'rotation speed' (optional)>"
        "setSwingMode":                 "<topic used to control 'swing mode' (optional)>",
        "getSwingMode":                 "<topic used to report 'swing mode' (optional)>",
        "setLockPhysicalControls":      "<topic used to control 'lock physical controls' (optional)>",
        "getLockPhysicalControls":      "<topic used to report 'lock physical controls' (optional)>",
        "getFilterChangeIndication":    "<topic used to report 'filter change indication' (optional)'>",
        "getFilterLifeLevel":           "<topic used to report 'filter life level' (optional)>",
        "setResetFilterIndication":     "<topic used to control 'reset filter indication (optional)'>"
    },
    "integerValue":                     "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue":                          "<value representing on (optional)>",
    "offValue":                         "<value representing off (optional)>",
    "targetAirPurifierStateValues":          "<array of values to be used to represent MANUAL, AUTO respectively (optional)>",
    "currentAirPurifierStateValues":         "<array of values to be used to represent INACTIVE, IDLE, PURIFYING respectively (optional)>",
    "swingModeValues":                  "<array of values to be used to represent DISABLED and ENABLED respectively (optional)>",
    "lockPhysicalControlsValues":       "<array of values to be used to represent DISABLED and ENABLED respectively (optional)>"
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
        "getRotationDirection": "<topic to notify homebridge of rotation direction (optional)>",
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
        "setTargetDoorState":       "<topic used to set 'target door state'>",
        "getTargetDoorState":       "<topic used to report 'target door state'>",
        "getCurrentDoorState":      "<topic used to report 'current door state'>",
        "setLockTargetState":       "<topic used to set 'lock target state' (optional)>",
        "getLockTargetState":       "<topic used to report 'lock target state' (optional)>",
        "getLockCurrentState":      "<topic used to report 'lock current state' (optional)>",
        "getObstructionDetected":   "<topic used to report 'obstruction detected' (optional)>"
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

Active state is set with a boolean value (see [Boolean Value Settings](../docs/Configuration.md#boolean-value-settings)).

Current heater/cooler state can be **INACTIVE**, **IDLE**, **HEATING** or **COOLING**. To use different values, specify an array of strings in **currentHeaterCoolerValues**. **INACTIVE** should be used in response if "Active" is set to false. **IDLE**, **HEATING** or **COOLING** should be used in response if "Active" is set to true.

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
        "setRotationMode":                  "<topic used to control 'rotation mode' (optional)>",
        "getRotationMode":                  "<topic used to report 'rotation mode' (optional)>",
        "setSwingMode":                     "<topic used to control 'swing mode' (optional)>",
        "getSwingMode":                     "<topic used to report 'swing mode' (optional)>",
        "setRotationSpeed":                 "<topic used to control 'rotation speed' (optional)>",
        "getRotationSpeed":                 "<topic used to report 'rotation speed' (optional)>"
    },
    "currentHeaterCoolerValues":            "<array of values to be used to represent INACTIVE, IDLE, HEATING, COOLING respectively (optional)>",
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


## Irrigation System

Multi-zone sprinkler accessory. See also [Valve (Sprinkler, Shower, Faucet)](#valve) for a single valve accessory.

If `durationTimer` is set to **true** (recommended), this plugin will handle the duration timer for each zone and will automatically send a stop command after the configured time.

If the device itself provides duration timing via MQTT or if you want to query or set the duration via MQTT, you can make use of `setDuration`/`getDuration`. The remaining time is shown in HomeKit even if no `getRemainingDuration` is configured. `getRemainingDuration` can be used to update the remaining time, if the duration is changed at the device itself in some way.

The topics under `"topics"` are optional. They describe the main topics for the entire system and are derived from the states of the individual zones. So `"topics"` might be empty (`"topics": {}`). Topics for the individual zones must be defined under `"zones" / "topics"`.

The default run time defaults to between 5 minutes and 1 hour (in 5 minute increments). This can be changed with `minDuration` and `maxDuration`. Note however that the Home App in iOS 12 doesn't like to show durations below 5 minutes. (This appears to have been improved in the iOS 13 Beta.)

```javascript
{
    "accessory": "mqttthing",
    "type": "irrigationSystem",
    "name": "<name of system>",
    "url": "<url of MQTT server (optional)>",
    "username": "<username for MQTT (optional)>",
    "password": "<password for MQTT (optional)>",
    "topics":
    {
        "getActive":      "<topic to report the target state (optional)>",
        "setActive":      "<topic to control the target state (optional)>",
        "getStatusFault": "<topic used to provide 'fault' status (optional)>"
    },
    "zones": [
        {
            "name": "First Zone",
            "topics": {
                "getActive":            "<topic to report the target state of the first zone>",
                "setActive":            "<topic to control the target state of the first zone>",
                "getInUse":             "<topic to report the current state feedback of the first zone>",
                "setDuration":          "<topic used to set default duration (seconds) (optional, with external timer)>",
                "getDuration":          "<topic used to get default duration (seconds) (optional, with external timer)>",
                "getRemainingDuration": "<topic used to get remaining duration (seconds) (optional, with external timer)>",
                "getStatusFault":       "<topic used to provide 'fault' status (optional)>"
            }
        },
        ...
        {
            "name": "Last Zone",
            "topics": {
                "getActive":            "<topic to report the target state of the last zone>",
                "setActive":            "<topic to control the target state of the last zone>",
                "getInUse":             "<topic to report the current state feedback of the last zone>",
                "setDuration":          "<topic used to set default duration (seconds) (optional, with external timer)>",
                "getDuration":          "<topic used to get default duration (seconds) (optional, with external timer)>",
                "getRemainingDuration": "<topic used to get remaining duration (seconds) (optional, with external timer)>",
                "getStatusFault":       "<topic used to provide 'fault' status (optional)>"
            }
        }
    ],
    "integerValue":  "true to use 1|0 instead of true|false default onValue and offValue",
    "onValue":       "<value representing on (optional)>",
    "offValue":      "<value representing off (optional)>",
    "durationTimer": "<true to enable duration timer (recommended)>",
    "minDuration":   "<minimum duration (in seconds) (optional)>",
    "maxDuration":   "<maximum duration (in seconds) (optional)>"
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

Light bulb can either use separate topics (for on, brightness, hue and saturation), or it can be configured to use a combined value holding comma-separated hue,sat,val or red,green,blue. Using a topic with combined values disables most of the other topics according to this [line](https://github.com/arachnetech/homebridge-mqttthing/blob/c2abf22dbef27bd329a038bd394a6ab112681fd6/index.js#L2462).

Hue is 0-360. Saturation is 0-100. Brightness is 0-100. Red, green and blue are 0-255. Colour temperature ranges from 140 (cold white) to 500 (warm white), centred at about 151.

If `topics.setHSV` is populated, a combined value is used and any individual brightness, hue, saturation and color temperature topics are ignored. On/off is sent with `setOn` if configured, or by setting V to 0 when off.

If `topics.setRGB` is populated, a combined value is used in the format red,green,blue (ranging from 0-255). On/off may be sent with `setOn`; brightness, hue and saturation topics are ignored. If `topics.setWhite` is also populated, the white level is extracted and sent separately to the combined RGB value.

Configuring `topics.setWhite` without `topics.setRGB` will give a dimmable white light with a range from 0 (off) to 255 (full brightness) using the `setWhite` topic only (i.e. with no separate on/off state through `setOn`).

If `topics.setRGBW` is populated, a combined value is used in the format red,green,blue,white (ranging from 0-255). The minimum of red, green and blue is subtracted from all three colour channels and sent to the white channel instead. On/off may be set with `setOn` (otherwise "0,0,0,0" indicates off); brightness, hue, saturation and temperature topics are ignored.

If `topics.setRGBWW` is populated, a combined value is used in the format red,green,blue,warm_white,cold_white (each component ranging from 0-255). Warm and cold white components are set based on the colour values published by Homekit from the _Temperature_ control, and after warm and cold white are extracted any remaining white level in the RGB values is sent equally to both white channels. The RGB values used for warm white and cold white extraction can be configured with `warmWhite` and `coldWhite`, allowing calibration to RGBWW LED colours. (Homekit's warm white and cold white colours are used by default.) On/off may be set with `setOn` (otherwise "0,0,0,0,0" indicates off); brightness, hue, saturation and temperature topics are ignored. (Homekit's behaviour when a coloured (hue/saturation-supporting) light also attempts to support temperature can be unpredictable - so the RGBWW implementation does not use Homekit colour temperature.) RGBWW lights support a `noWhiteMix` option which when set to true disables extraction of white components from colours - i.e. powering only RGB channels or WW,CW channels. When `noWhiteMix` is *true*, `redThreshold`, `greenThreshold` and `blueThreshold` may optionally be configured with the colour offsets above which RGB is used instead of WW; their default value is 15. To order by cold_white,warm_white, set `switchWhites` to *true*.

Set `confirmationPeriodms` to enable publishing confirmation for `setOn`/`getOn`. The accessory must echo messages it receives through the `setOn` subject to the `getOn` subject, otherwise homebridge-mqttthing will mark it as unresponsive and republish on the `setOn` subject.

When using colour temperature directly (through the `setColorTemperature` topic), `minColorTemperature` and `maxColorTemperature` may be configured to change Homekits default range of 140-500.

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
    "coldWhite": "in RGBWW mode, RGB value of cold white in format red,green,blue (optional)",
    "minColorTemperature": 140,
    "maxColorTemperature": 500
}
```

Coloured lights and lights with a setColorTemperature topic support adaptive lighting by default. This may change behaviour when setting colour temperature manually on a bulb without a setColorTemperature topic, as calculation of appropriate hue and saturation values must be done within Homebridge instead of by Homekit. Adaptive lighting support can be disabled by setting `adaptiveLighting` to `false`.

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
        "setLockTargetState":       "<topic used to set 'lock target state'>",
        "getLockTargetState":       "<topic used to provide 'lock target state'>",
        "getLockCurrentState":      "<topic used to provide 'lock current state'>"
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
        "setTargetState":    "<topic used to set 'target state'>",
        "getTargetState":    "<topic used to get 'target state'>",
        "getCurrentState":   "<topic used to get 'current state'>",
        "getStatusFault":    "<topic used to provide 'fault' status (optional)>",
        "getStatusTampered": "<topic used to provide 'tampered' status (optional)>"
        "getAltStatusTriggered": "<topic used to provide an alternative 'triggered' boolean status (optional)>"
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
            "<array of 3 switch values corresponding to single-press, double-press and long-press respectively for switch 1 (optional)>",
            "<array of 3 switch values corresponding to single-press, double-press and long-press respectively for switch 2 (optional)>",
            "<array of 3 switch values corresponding to single-press, double-press and long-press respectively for switch 3 (optional)>"
        ],
    "switchValues": "<array of 3 switch values corresponding to single-press, double-press and long-press respectively (optional)>",
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

Single valve accessory. `valveType` can be `"sprinkler"`, `"shower"` or `"faucet"`. See also [Irrigation System](#irrigation-system) for multi-zone sprinkler accessories.

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
        "getCurrentAmbientLightLevel":  "<topic used to provide 'current ambient light level (optional)'>",
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
        "getCurrentPosition":            "<topic used to report current position (integer 0-100)>",
        "setTargetPosition":             "<topic used to control target position (integer 0-100)>",
        "getTargetPosition":             "<topic used to report target position (optional)>",
        "getPositionState":              "<topic used to report position state>",
        "setHoldPosition":               "<topic used to control hold position (Boolean)>",
        "setTargetHorizontalTiltAngle":  "<topic used to control target horizontal tilt angle (-90 to 90)>",
        "getTargetHorizontalTiltAngle":  "<topic used to report target horizontal tilt angle (optional)>",
        "getCurrentHorizontalTiltAngle": "<topic used to report current horizontal tilt angle>",
        "setTargetVerticalTiltAngle":    "<topic used to control target vertical tilt angle (-90 to 90)>",
        "getTargetVerticalTiltAngle":    "<topic used to report target vertical tilt angle (optional)>",
        "getCurrentVerticalTiltAngle":   "<topic used to report current vertical tilt angle>",
        "getObstructionDetected":        "<topic used to report whether an obstruction is detected (Boolean)>"
    },
    "positionStateValues": [ "decreasing-value", "increasing-value", "stopped-value" ]
}
```
