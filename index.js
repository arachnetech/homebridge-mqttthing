// MQTT Thing Accessory plugin for Homebridge
// A Homebridge plugin for serveral services, based on homebrige-mqtt-switch and homebridge-mqttlightbulb

/* eslint-disable object-property-newline */
/* eslint-disable no-plusplus */

'use strict'; // eslint-disable-line

var os = require("os");
var packagedef = require('./package.json');
var homebridgeLib = require('homebridge-lib');
var fakegatoHistory = require('fakegato-history');
var fs = require("fs");
var path = require("path");
var mqttlib = require( './libs/mqttlib' );

var Service, Characteristic, Eve, HistoryService;
var homebridgePath;

function makeThing(log, config) {

    // Migrate old-style history options
    if( config.hasOwnProperty( 'history' ) ) {
        if( typeof config.history == 'object' ) {
            config.historyOptions = config.history;
            config.history = true;
        } else {
            if( ! config.hasOwnProperty( 'historyOptions' ) ) {
                config.historyOptions = {};
            }
        }
        // migrate negated options for config-ui-x defaults
        if( ! config.historyOptions.hasOwnProperty( 'noAutoTimer' ) ) {
            config.historyOptions.noAutoTimer = ( config.historyOptions.autoTimer === false );
        }
        if( ! config.historyOptions.hasOwnProperty( 'noAutoRepeat' ) ) {
            config.historyOptions.noAutoRepeat = ( config.historyOptions.autoRepeat === false );
        }
    }

    // History persistence path
    function historyPersistencePath() {
        let directory;
        if( config.historyOptions && config.historyOptions.persistencePath ) {
            if( config.historyOptions.persistencePath[ 0 ] == '/' ) {
                // full path
                directory = config.historyOptions.persistencePath;
            } else {
                // assume relative to homebridge path
                directory = path.join( homebridgePath, config.historyOptions.persistencePath );
            }
        } else {
            // no path configured - use homebridge path
            directory = homebridgePath;
        }
        return directory;
    }
    function historyCounterFile() {
        const counterFile = path.join(historyPersistencePath(), os.hostname().split(".")[0] + "_" + config.name + "_cnt_persist.json");
        return counterFile;
    }

    //
    //  MQTT Wrappers
    //

    // Initialize MQTT client
    let ctx = { log, config, homebridgePath };
    mqttlib.init( ctx );

    // MQTT Subscribe
    function mqttSubscribe( topic, property, handler ) {
        mqttlib.subscribe( ctx, topic, property, handler );
    }

    // MQTT Publish
    function mqttPublish( topic, property, message ) {
        mqttlib.publish( ctx, topic, property, message );
    }

    // Delayed one-shot function call
    let throttledCallTimers = {};
    let throttledCall = function( func, identifier, timeout ) {
        if( throttledCallTimers[ identifier ] ) {
            clearTimeout( throttledCallTimers[ identifier ] );
        }
        throttledCallTimers[ identifier ] = setTimeout( function() {
            throttledCallTimers[ identifier ] = null;
            func();
        }, timeout );
    }

    var c_mySetContext = '---my-set-context--';

    // constructor for fakegato-history options
    function HistoryOptions(isEventSensor=false) {
        // maximum size of stored data points
        this.size = config.historyOptions.size || 4032;
        // data will be stored in .homebridge or path specified with homebridge -U option
        this.storage = 'fs';
        if( config.historyOptions.persistencePath ) {
            this.path = historyPersistencePath();
        }
        if(config.historyOptions.noAutoTimer===true || config.historyOptions.mergeInterval) {
            // disable averaging (and repeating) interval timer
            // if mergeInterval is used, then autoTimer has to be deactivated (inconsistencies possible)
            this.disableTimer = true;
        }
        // disable repetition (if no data was received in last interval)
        if (config.historyOptions.noAutoRepeat===true) {
            if (isEventSensor) {
                // for 'motion' and 'door' type
                this.disableTimer = true;
            } else {
                // for 'weather', 'room' and 'energy' type
                this.disableRepeatLastData = true;
            }
        }
    }

    // The states of our characteristics
    var state = ctx.state = {};

    // Internal event handling
    var events = {};

    function raiseEvent( property ) {
        if( events.hasOwnProperty( property ) ) {
            events[ property ]();
        }
    }

    function makeConfirmedPublisher( setTopic, getTopic, property, makeConfirmed ) {
        return mqttlib.makeConfirmedPublisher( ctx, setTopic, getTopic, property, makeConfirmed );
    }

    //! Determine appropriate on/off value for Boolean property (not forced to string) for MQTT publishing.
    //! Returns null if no offValue.
    function getOnOffPubValue( value ) {
        let mqttval;
        if( config.onValue ) {
            // using onValue/offValue
            mqttval = value ? config.onValue : config.offValue;
        } else if( config.integerValue ) {
            mqttval = value ? 1 : 0;
        } else {
            mqttval = value ? true : false;
        }
        if( mqttval === undefined || mqttval === null ) {
            return null;
        } else {
            return mqttval;
        }
    }

    //! Test whether a value represents 'on'
    function isRecvValueOn( mqttval ) {
        let onval = getOnOffPubValue( true );
        return mqttval === onval || mqttval == ( onval + '' );
    }

    //! Test whether a value represents 'off'
    function isRecvValueOff( mqttval ) {
        let offval = getOnOffPubValue( false );
        
        if( offval === null ) {
            // there is no off value
            return false;
        }

        if( mqttval === offval || mqttval == ( offval + '' ) ) {
            // off value match - it's definitely off
            return true;
        }

        if( config.otherValueOff ) {
            if( ! isRecvValueOn( mqttval ) ) {
                // it's not the on value and we consider any other value to be off
                return true;
            }
        }

        // not off
        return false;
    }

    function getOnlineOfflinePubValue( value ) {
        var pubVal = ( value ? config.onlineValue : config.offlineValue );
        if( pubVal === undefined ) {
            pubVal = getOnOffPubValue( value );
        }
        return pubVal;
    }

    function isRecvValueOnline( mqttval ) {
        let onval = getOnlineOfflinePubValue( true );
        return mqttval === onval || mqttval == ( onval + '' );
    }

    function isRecvValueOffline( mqttval ) {
        let offval = getOnlineOfflinePubValue( false );
        return mqttval === offval || mqttval == ( offval + '' );
    }

    function mapValueForHomebridge(val, mapValueFunc) {
        if (mapValueFunc) {
            return mapValueFunc(val);
        } else {
            return val;
        }
    }

    function isOffline() {
        return state.online === false;
    }

    function handleGetStateCallback( callback, value ) {
        if( isOffline() ) {
            callback( 'offline' );
        } else {
            callback( null, value );
        }
    }

    function booleanCharacteristic(service, property, characteristic, setTopic, getTopic, initialValue, mapValueFunc, turnOffAfterms, resetStateAfterms, enableConfirmation) {

        var publish = makeConfirmedPublisher( setTopic, getTopic, property, enableConfirmation );

        // auto-turn-off and reset-state timers
        var autoOffTimer = null;
        var autoResetStateTimer = null;

        // default state
        state[property] = (initialValue ? true : false);

        // set up characteristic
        var charac = service.getCharacteristic(characteristic);
        charac.on('get', function (callback) {
            handleGetStateCallback( callback, state[ property ] );
        });
        if (setTopic) {
            charac.on('set', function (value, callback, context) {
                if (context !== c_mySetContext) {
                    state[property] = value;
                    publish( getOnOffPubValue( value ) );
                }
                callback();

                // optionally turn off after timeout
                if( value && turnOffAfterms ) {
                    if( autoOffTimer ) {
                        clearTimeout( autoOffTimer );
                    }
                    autoOffTimer = setTimeout( function() {
                        autoOffTimer = null;

                        state[property] = false;
                        publish( getOnOffPubValue( false ) );
                        service.getCharacteristic(characteristic).setValue(mapValueForHomebridge(false, mapValueFunc), undefined, c_mySetContext);

                    }, turnOffAfterms );
                }
            });
        }
        if (initialValue) {
            charac.setValue(mapValueForHomebridge(initialValue, mapValueFunc), undefined, c_mySetContext);
        }

        // subscribe to get topic
        if (getTopic) {
            mqttSubscribe(getTopic, property, function (topic, message) {
                // determine whether this is an on or off value
                let newState = false; // assume off
                if( isRecvValueOn( message ) ) {
                    newState = true; // received on value so on
                } else if ( ! isRecvValueOff( message ) ) {
                    // received value NOT acceptable as 'off' so ignore message
                    return;
                }
                // if it changed, set characteristic
                if (state[property] != newState) {
                    state[property] = newState;
                    service.getCharacteristic(characteristic).setValue(mapValueForHomebridge(newState, mapValueFunc), undefined, c_mySetContext);
                }
                // optionally reset state to OFF after a timeout
                if( newState && resetStateAfterms ) {
                    if( autoResetStateTimer ) {
                        clearTimeout( autoResetStateTimer );
                    }
                    autoResetStateTimer = setTimeout( function() {
                        autoResetStateTimer = null;
                        state[ property ] = false;
                        service.getCharacteristic(characteristic).setValue(mapValueForHomebridge(false, mapValueFunc), undefined, c_mySetContext);
                    }, resetStateAfterms );
                }
            } );
        }
    }

    function booleanState( property, getTopic, initialValue, isOnFunc, isOffFunc ) {
        // default state
        state[ property ] = ( initialValue ? true : false );

        // MQTT subscription
        if( getTopic ) {
            mqttSubscribe( getTopic, property, function( topic, message ) {
                if( isOnFunc( message ) ) {
                    state[ property ] = true;
                } else if( isOffFunc( message ) ) {
                    state[ property ] = false;
                }
            } );
        }
    }

    function state_Online() {
        booleanState( 'online', config.topics.getOnline, true, isRecvValueOnline, isRecvValueOffline );
    }

    function integerCharacteristic(service, property, characteristic, setTopic, getTopic, initialValue) {
        // default state
        state[property] = initialValue || 0;

        // set up characteristic
        var charac = service.getCharacteristic(characteristic);
        charac.on('get', function (callback) {
            handleGetStateCallback( callback, state[ property ] );
        });
        if (setTopic) {
            charac.on('set', function (value, callback, context) {
                if (context !== c_mySetContext) {
                    state[property] = value;
                    mqttPublish(setTopic, property, value);
                }
                callback();
            });
        }
        if (initialValue) {
            charac.setValue(initialValue, undefined, c_mySetContext);
        }

        // subscribe to get topic
        if (getTopic) {
            mqttSubscribe(getTopic, property, function (topic, message) {
                var newState = parseInt(message);
                if (state[property] != newState) {
                    state[property] = newState;
                    service.getCharacteristic(characteristic).setValue(newState, undefined, c_mySetContext);
                }
            });
        }
    }

    function addCharacteristic( service, property, characteristic, defaultValue, characteristicChanged ) {

        state[ property ] = defaultValue;

        var charac = service.getCharacteristic( characteristic );

        charac.setValue( defaultValue, undefined, c_mySetContext );

        charac.on( 'get', function( callback ) {
            handleGetStateCallback( callback, state[ property ] );
        } );

        if( characteristicChanged ) {
            charac.on( 'set', function( value, callback, context ) {
                if( context !== c_mySetContext ) {
                    state[ property ] = value;
                    characteristicChanged();
                }
                callback();
            } );
        }
    }

    function characteristics_HSVLight( service ) {

        let lastpubmsg = '';

        function publishNow() {
            var bri = state.bri;
            if( ! config.topics.setOn && ! state.on ) {
                bri = 0;
            }
            var msg = state.hue + ',' + state.sat + ',' + bri;
            if( msg != lastpubmsg ) {
                mqttPublish( config.topics.setHSV, 'HSV', msg );
                lastpubmsg = msg;
            }
        }

        function publish() {
            throttledCall( publishNow, 'hsv_publish', 20 );
        }

        if( config.topics.setOn ) {
            characteristic_On( service );
        } else {
            addCharacteristic( service, 'on', Characteristic.On, 0, function() {
                if( state.on && state.bri == 0 ) {
                    state.bri = 100;
                }
                publish();
            } );
        }
        addCharacteristic( service, 'hue', Characteristic.Hue, 0, publish );
        addCharacteristic( service, 'sat', Characteristic.Saturation, 0, publish );
        addCharacteristic( service, 'bri', Characteristic.Brightness, 100, function() {
            if( state.bri > 0 && ! state.on ) {
                state.on = true;
            }
            publish();
        } );

        if( config.topics.getHSV ) {
            mqttSubscribe( config.topics.getHSV, 'HSV', function( topic, message ) {
                var comps =  ('' + message ).split( ',' );
                if( comps.length == 3 ) {
                    var hue = parseInt( comps[ 0 ] );
                    var sat = parseInt( comps[ 1 ] );
                    var bri = parseInt( comps[ 2 ] );

                    if( ! config.topics.setOn ) {
                        var on = bri > 0 ? 1 : 0;

                        if( on != state.on ) {
                            state.on = on;
                            //log( 'on ' + on );
                            service.getCharacteristic( Characteristic.On ).setValue( on, undefined, c_mySetContext );
                        }
                    }

                    if( hue != state.hue ) {
                        state.hue = hue;
                        //log( 'hue ' + hue );
                        service.getCharacteristic( Characteristic.Hue ).setValue( hue, undefined, c_mySetContext );
                    }

                    if( sat != state.sat ) {
                        state.sat = sat;
                        //log( 'sat ' + sat );
                        service.getCharacteristic( Characteristic.Saturation ).setValue( sat, undefined, c_mySetContext );
                    }

                    if( bri != state.bri ) {
                        state.bri = bri;
                        //log( 'bri ' + bri );
                        service.getCharacteristic( Characteristic.Brightness ).setValue( bri, undefined, c_mySetContext );
                    }
                }
            } );
        }
    }

    /*
     * HSV to RGB conversion from https://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately
     * accepts parameters
     * h  Object = {h:x, s:y, v:z}
     * OR
     * h, s, v
     */
    function HSVtoRGB(h, s, v) {
        var r, g, b, i, f, p, q, t;
        if (arguments.length === 1) {
            s = h.s, v = h.v, h = h.h;
        }
        i = Math.floor(h * 6);
        f = h * 6 - i;
        p = v * (1 - s);
        q = v * (1 - f * s);
        t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    function ScaledHSVtoRGB( h, s, v ) {
        return HSVtoRGB( h / 360, s / 100, v / 100 );
    }

    /* accepts parameters
     * r  Object = {r:x, g:y, b:z}
     * OR
     * r, g, b
     */
    function RGBtoHSV(r, g, b) {
        if (arguments.length === 1) {
            g = r.g, b = r.b, r = r.r;
        }
        var max = Math.max(r, g, b), min = Math.min(r, g, b),
            d = max - min,
            h,
            s = (max === 0 ? 0 : d / max),
            v = max / 255;

        switch (max) {
            case min: h = 0; break;
            case r: h = (g - b) + d * (g < b ? 6: 0); h /= 6 * d; break;
            case g: h = (b - r) + d * 2; h /= 6 * d; break;
            case b: h = (r - g) + d * 4; h /= 6 * d; break;
        }

        return {
            h: h,
            s: s,
            v: v
        };
    }

    function RGBtoScaledHSV( r, g, b ) {
        var hsv = RGBtoHSV( r, g, b );
        return {
            h: hsv.h * 360,
            s: hsv.s * 100,
            v: hsv.v * 100
        };
    }

    // byte to 2-characters of hex
    function toHex( num ) {
        var s = '0' + num.toString( 16 );
        return s.substr( s.length - 2 );
    }

    function decodeRGBCommaSeparatedString( rgb ) {
        if( rgb ) {
            var comps =  ('' + rgb ).split( ',' );
            if( comps.length == 3 ) {
                return {r: comps[ 0 ], g: comps[ 1 ], b: comps[ 2 ]};
            }
        }
    }

    /*function calcWhiteFactor1( rgbin, white ) {
        // scale rgb value to full brightness as comparing colours
        let compmax = Math.max( rgbin.r, rgbin.g, rgbin.b );
        if( compmax < 1 ) {
            return 0;
        }
        let rgbsc = 255 / compmax;
        let rgb = {r: rgbin.r * rgbsc, g: rgbin.g * rgbsc, b: rgbin.b * rgbsc};
        // calculate factors
        var rf = 1, gf = 1, bf = 1;
        if( white.r < 255 ) {
            rf = ( 255 - rgb.r ) / ( 255 - white.r ) / rgbsc;
        }
        if( white.g < 255 ) {
            gf = ( 255 - rgb.g ) / ( 255 - white.g ) / rgbsc;
        }
        if( white.b < 255 ) {
            bf = ( 255 - rgb.b ) / ( 255 - white.b ) / rgbsc;
        }

        return Math.min( Math.max( 0, Math.min( rf, gf, bf ) ), 1 );
    }*/

    function calcWhiteFactor2( rgbin, white ) {
        // scale rgb value to full brightness as comparing colours
        let compmax = Math.max( rgbin.r, rgbin.g, rgbin.b );
        if( compmax < 1 ) {
            return 0;
        }
        let rgbsc = 255 / compmax;
        let rgb = {r: rgbin.r * rgbsc, g: rgbin.g * rgbsc, b: rgbin.b * rgbsc};
        // calculate factors
        let wmin = Math.min( white.r, white.g, white.b );
        let cmin = Math.min( rgb.r, rgb.g, rgb.b );
        var rf = 1, gf = 1, bf = 1;
        if( white.r > wmin ) {
            rf = ( rgb.r - cmin ) / ( white.r - wmin ) / rgbsc;
        }
        if( white.g > wmin ) {
            gf = ( rgb.g - cmin ) / ( white.g - wmin ) / rgbsc;
        }
        if( white.b > wmin ) {
            bf = ( rgb.b - cmin ) / ( white.b - wmin ) / rgbsc;
        }

        return Math.min( Math.max( 0, Math.min( rf, gf, bf ) ), 1 );
    }

    function calcWhiteFactor( rgb, white ) {
        let rf = 1, gf = 1, bf = 1;
        if( white.r > 0 ) {
            rf = rgb.r / white.r;
        }
        if( white.g > 0 ) {
            gf = rgb.g / white.g;
        }
        if( white.b > 0 ) {
            bf = rgb.b / white.b;
        }
        return Math.min( Math.max( 0, Math.min( rf, gf, bf, calcWhiteFactor2( rgb, white ) ) ), 1 );
    }

    function characteristics_RGBLight( service ) {

        var warmWhiteRGB, coldWhiteRGB;

        state.red = 0;
        state.green = 0;
        state.blue = 0;
        state.white = 0;
        state.warmWhite = 0;
        state.coldWhite = 0;

        var setTopic, getTopic, numComponents, property;
        var wwcwComps = false;
        var whiteComp = false;
        var whiteSep = false;
        if( config.topics.setRGBWW ) {
            setTopic = config.topics.setRGBWW;
            getTopic = config.topics.getRGBWW;
            property = 'RGBWW';
            wwcwComps = true;
            numComponents = 5;
            warmWhiteRGB = decodeRGBCommaSeparatedString( config.warmWhite ) || {r: 255, g: 158, b: 61};
            coldWhiteRGB = decodeRGBCommaSeparatedString( config.coldWhite ) || {r: 204, g: 219, b: 255};
        } else if( config.topics.setRGBW ) {
            setTopic = config.topics.setRGBW;
            getTopic = config.topics.getRGBW;
            property = 'RGBW';
            whiteComp = true;
            numComponents = 4;
        } else {
            setTopic = config.topics.setRGB;
            getTopic = config.topics.getRGB;
            property = 'RGB';
            if( config.topics.setWhite ) {
                whiteSep = true;
            }
            numComponents = 3;
        }

        var hexPrefix = null;
        if( config.hexPrefix ) {
            hexPrefix = config.hexPrefix;
        } else if( config.hex ) {
            hexPrefix = '';
        }

        let lastpubmsg = '';

        function publishNow() {
            var bri = state.bri;
            if( ! config.topics.setOn && ! state.on ) {
                bri = 0;
            }
            var rgb = ScaledHSVtoRGB( state.hue, state.sat, bri );

            if( wwcwComps ) {
                //console.log( rgb );
                // calculate warm-white and cold-white factors (0-1 indicating proportion of warm/cold white in colour)
                let warmFactor = calcWhiteFactor( rgb, warmWhiteRGB );
                let coldFactor = calcWhiteFactor( rgb, coldWhiteRGB );
                //console.log( "wf: " + warmFactor );
                //console.log( "cf: " + coldFactor );
                // sum must be below 1
                let whiteFactor = warmFactor + coldFactor;
                if( whiteFactor > 1 ) {
                    warmFactor = warmFactor / whiteFactor;
                    coldFactor = coldFactor / whiteFactor;
                    whiteFactor = 1;
                }
                // manipulate RGB values
                rgb.ww = Math.floor(warmFactor * 255);
                rgb.cw = Math.floor(coldFactor * 255);
                //console.log( "ww: " + rgb.ww );
                //console.log( "cw: " + rgb.cw );
                /*rgb.r = Math.floor( rgb.r * ( 1 - whiteFactor ) );
                rgb.g = Math.floor( rgb.g * ( 1 - whiteFactor ) );
                rgb.b = Math.floor( rgb.b * ( 1 - whiteFactor ) );*/
                rgb.r = Math.max( 0, Math.floor( rgb.r - warmFactor * warmWhiteRGB.r - coldFactor * coldWhiteRGB.r ) );
                rgb.g = Math.max( 0, Math.floor( rgb.g - warmFactor * warmWhiteRGB.g - coldFactor * coldWhiteRGB.g ) );
                rgb.b = Math.max( 0, Math.floor( rgb.b - warmFactor * warmWhiteRGB.b - coldFactor * coldWhiteRGB.b ) );
                // any remaining pure white level can be replaced with a mixture of cold and warm white
                let min = Math.min( rgb.r, rgb.g, rgb.b, 255 - rgb.ww, 255 - rgb.cw );
                rgb.ww += Math.floor( min / 2 );
                rgb.cw += Math.floor( min / 2 );
                rgb.r -= min;
                rgb.g -= min;
                rgb.b -= min;
                // store white state
                state.warmWhite = rgb.ww;
                state.coldWhite = rgb.cw;
            } else if( whiteSep || whiteComp ) {
                // remove common component from red, green and blue to white
                let min = Math.min( rgb.r, rgb.g, rgb.b );
                rgb.w = min;
                rgb.r -= min;
                rgb.g -= min;
                rgb.b -= min;

                state.white = rgb.w;
            }
            state.red = rgb.r;
            state.green = rgb.g;
            state.blue = rgb.b;

            var msg;
            if( hexPrefix == null ) {
                // comma-separated decimal
                msg = rgb.r + ',' + rgb.g + ',' + rgb.b;
                if( whiteComp ) {
                    msg += ',' + rgb.w;
                } else if( wwcwComps ) {
                    msg += ',' + rgb.ww + ',' + rgb.cw;
                }
            } else {
                // hex
                msg = hexPrefix + toHex( rgb.r ) + toHex( rgb.g ) + toHex( rgb.b );
                if( whiteComp ) {
                    msg += toHex( rgb.w );
                } else if( wwcwComps ) {
                    msg += toHex( rgb.ww ) + toHex( rgb.cw );
                }
            }
            if( msg != lastpubmsg ) {
                mqttPublish( setTopic, property, msg );
                lastpubmsg = msg;
            }

            if( whiteSep ) {
                mqttPublish( config.topics.setWhite, 'white', rgb.w );
            }
        }

        // hold off before publishing to ensure that all updated properties are collected first
        function publish() {
            throttledCall( publishNow, 'rgb_publish', 20 );
        }

        if( config.topics.setOn ) {
            characteristic_On( service );
        } else {
            addCharacteristic( service, 'on', Characteristic.On, 0, function() {
                if( state.on && state.bri == 0 ) {
                    state.bri = 100;
                }
                publish();
            } );
        }
        addCharacteristic( service, 'hue', Characteristic.Hue, 0, publish );
        addCharacteristic( service, 'sat', Characteristic.Saturation, 0, publish );
        addCharacteristic( service, 'bri', Characteristic.Brightness, 100, function() {
            if( state.bri > 0 && ! state.on ) {
                state.on = true;
            }

            publish();
        } );

        function updateColour( red, green, blue, white, warmWhite, coldWhite ) {

            // add warm white/cold white in
            if( wwcwComps ) {
                red += Math.floor( warmWhiteRGB.r * warmWhite / 255 ) + Math.floor( coldWhiteRGB.r * coldWhite / 255 );
                green += Math.floor( warmWhiteRGB.g * warmWhite / 255 ) + Math.floor( coldWhiteRGB.g * coldWhite / 255 );
                blue += Math.floor( warmWhiteRGB.b * warmWhite / 255 ) + Math.floor( coldWhiteRGB.b * coldWhite / 255 );
            }

            // add any white component to red, green and blue
            red = Math.min( red + white, 255 );
            green = Math.min( green + white, 255 );
            blue = Math.min( blue + white, 255 );

            var hsv = RGBtoScaledHSV( red, green, blue );
            var hue = hsv.h;
            var sat = hsv.s;
            var bri = hsv.v;

            if( ! config.topics.setOn ) {
                var on = bri > 0 ? 1 : 0;

                if( on != state.on ) {
                    state.on = on;
                    //log( 'on ' + on );
                    service.getCharacteristic( Characteristic.On ).setValue( on, undefined, c_mySetContext );
                }
            }

            if( hue != state.hue ) {
                state.hue = hue;
                //log( 'hue ' + hue );
                service.getCharacteristic( Characteristic.Hue ).setValue( hue, undefined, c_mySetContext );
            }

            if( sat != state.sat ) {
                state.sat = sat;
                //log( 'sat ' + sat );
                service.getCharacteristic( Characteristic.Saturation ).setValue( sat, undefined, c_mySetContext );
            }

            if( bri != state.bri ) {
                state.bri = bri;
                //log( 'bri ' + bri );
                service.getCharacteristic( Characteristic.Brightness ).setValue( bri, undefined, c_mySetContext );
            }
        }

        if( getTopic ) {
            mqttSubscribe( getTopic, property, function( topic, message ) {
                var ok = false;
                var red, green, blue, white, warmWhite, coldWhite;
                if( hexPrefix == null ) {
                    // comma-separated decimal
                    var comps =  ('' + message ).split( ',' );
                    if( comps.length == numComponents ) {
                        red = parseInt( comps[ 0 ] );
                        green = parseInt( comps[ 1 ] );
                        blue = parseInt( comps[ 2 ] );
                        if( whiteComp ) {
                            white = parseInt( comps[ 3 ] );
                        } else if( wwcwComps ) {
                            warmWhite = parseInt( comps[ 3 ] );
                            coldWhite = parseInt( comps[ 4 ] );
                        }
                        ok = true;
                    }
                } else {
                    // hex
                    if( message.length == hexPrefix.length + 2 * numComponents ) {
                        message = '' + message;
                        if( message.substr( 0, hexPrefix.length ) == hexPrefix ) {
                            red = parseInt( message.substr( hexPrefix.length, 2 ), 16 );
                            green = parseInt( message.substr( hexPrefix.length + 2, 2 ), 16 );
                            blue = parseInt( message.substr( hexPrefix.length + 4, 2 ), 16 );
                            if( whiteComp ) {
                                white = parseInt( message.substr( hexPrefix.length + 6, 2 ), 16 );
                            } else if( wwcwComps ) {
                                warmWhite = parseInt( message.substr( hexPrefix.length + 6, 2 ), 16 );
                                coldWhite = parseInt( message.substr( hexPrefix.length + 8, 2 ), 16 );
                            }
                            ok = true;
                        }
                    }
                }
                if( ok ) {
                    state.red = red;
                    state.green = green;
                    state.blue = blue;
                    if( whiteComp ) {
                        state.white = white;
                        updateColour( red, green, blue, white );
                    } else if( wwcwComps ) {
                        state.warmWhite = warmWhite;
                        state.coldWhite = coldWhite;
                        updateColour( red, green, blue, 0, warmWhite, coldWhite );
                    } else if( whiteSep ) {
                        updateColour( red, green, blue, state.white );
                    } else {
                        updateColour( red, green, blue, 0 );
                    }
                }
            } );
        }

        if( whiteSep ) {
            mqttSubscribe( config.topics.getWhite, 'white', function( topic, message ) {
                state.white = parseInt( message );
                updateColour( state.red, state.green, state.blue, state.white );
            } );
        }
    }

    function characteristics_WhiteLight( service ) {
        state.white = 0;
        var hexPrefix = null;
        if( config.hexPrefix ) {
            hexPrefix = config.hexPrefix;
        } else if( config.hex ) {
            hexPrefix = '';
        }

        function publish() {
            var bri = state.bri;
            if( ! state.on ) {
                bri = 0;
            }
            var white = Math.min( Math.ceil( bri * 2.55 ), 255 );
            var msg;
            if( hexPrefix == null ) {
                msg = white;
            } else {
                msg = hexPrefix + toHex( white );
            }
            mqttPublish( config.topics.setWhite, 'white', msg );
        }

        addCharacteristic( service, 'on', Characteristic.On, 0, function() {
            if( state.on && state.bri == 0 ) {
                state.bri = 100;
            }
            publish();
        } );

        addCharacteristic( service, 'bri', Characteristic.Brightness, 100, function() {
            if( state.bri > 0 && ! state.on ) {
                state.on = true;
            }

            publish();
        } );

        if( config.topics.getWhite ) {
            mqttSubscribe( config.topics.getWhite, 'white', function( topic, message ) {
                var ok = false;
                var white;
                if( hexPrefix == null ) {
                    var comps = ('' + message ).split( ',' );
                    if( comps.length == 1 ) {
                        white = parseInt( comps[ 0 ] );
                        ok = true;
                    }
                } else {
                     // hex
                     if( message.length == hexPrefix.length + 2 ) {
                         message = '' + message;
                         if( message.substr( 0, hexPrefix.length ) == hexPrefix ) {
                            white = parseInt( message.substr( hexPrefix.length, 2 ), 16 );
                            ok = true;
                        }
                     }
                }
                if( ok ) {
                    let bri = Math.min( Math.floor( white / 2.55 ), 100 );
                    var on = bri > 0 ? 1 : 0;

                    if( on != state.on ) {
                        state.on = on;
                        service.getCharacteristic( Characteristic.On ).setValue( on, undefined, c_mySetContext );
                    }

                    if( bri != state.bri ) {
                        state.bri = bri;
                        service.getCharacteristic( Characteristic.Brightness ).setValue( bri, undefined, c_mySetContext );
                    }
                }
            } );
        }
    }

    function floatCharacteristic(service, property, characteristic, setTopic, getTopic, initialValue) {
        // default state
        state[property] = initialValue;

        // set up characteristic
        var charac = service.getCharacteristic(characteristic);
        charac.on('get', function (callback) {
            handleGetStateCallback( callback, state[ property ] );
        });
        if (setTopic) {
            charac.on('set', function (value, callback, context) {
                if (context !== c_mySetContext) {
                    state[property] = value;
                    mqttPublish(setTopic, property, value);
                }
                callback();
            });
        }
        if (initialValue) {
            charac.setValue(initialValue, undefined, c_mySetContext);
        }

        // subscribe to get topic
        if (getTopic) {
            mqttSubscribe(getTopic, property, function (topic, message) {
                var newState = parseFloat(message);
                if (state[property] != newState) {
                    state[property] = newState;
                    service.getCharacteristic(characteristic).setValue(newState, undefined, c_mySetContext);
                }
            });
        }
    }

    function stringCharacteristic(service, property, characteristic, setTopic, getTopic, initialValue) {
        // default state
        state[property] = initialValue ? initialValue : '';

        // set up characteristic
        var charac = service.getCharacteristic(characteristic);
        charac.on('get', function (callback) {
            handleGetStateCallback( callback, state[ property ] );
        });
        if (setTopic) {
            charac.on('set', function (value, callback, context) {
                if (context !== c_mySetContext) {
                    state[property] = value;
                    mqttPublish(setTopic, property, value);
                }
                callback();
            });
        }

        // subscribe to get topic
        if (getTopic) {
            mqttSubscribe(getTopic, property, function (topic, message) {
                var newState = message.toString();
                if (state[property] !== newState) {
                    state[property] = newState;
                    service.getCharacteristic(characteristic).setValue(newState, undefined, c_mySetContext);
                }
            });
        }
    }

    function multiCharacteristic(service, property, characteristic, setTopic, getTopic, values, initialValue, eventOnly) {
        // Values is an array of MQTT values indexed by <value of Homekit enumeration>.
        // Build map of MQTT values to homekit values
        var mqttToHomekit = {};
        for (let i = 0; i < values.length; i++) {
            mqttToHomekit[values[i]] = i;
        }

        state[property] = initialValue;

        var charac = service.getCharacteristic(characteristic);

        // Homekit get
        if (!eventOnly) {
            charac.on('get', function (callback) {
                handleGetStateCallback( callback, state[ property ] );
            });
        }

        // Homekit set
        if (setTopic) {
            charac.on('set', function (value, callback, context) {
                if (context !== c_mySetContext) {
                    state[property] = value;
                    let mqttVal = values[value];
                    if (mqttVal !== undefined) {
                        mqttPublish(setTopic, property, mqttVal);
                    }
                    raiseEvent( property );
                }
                callback();
            });
        }

        if (initialValue) {
            charac.setValue(initialValue, undefined, c_mySetContext);
        }

        // MQTT set (Homekit get)
        if (getTopic) {
            mqttSubscribe(getTopic, property, function (topic, message) {
                let data = message.toString();
                let newState = mqttToHomekit[data];
                if (newState !== undefined && ( eventOnly || state[property] != newState ) ) {
                    if( config.logMqtt ) {
                        log( 'State ' + property + ' is now: ' + newState );
                    }
                    state[property] = newState;
                    service.getCharacteristic(characteristic).setValue(newState, undefined, c_mySetContext);
                    raiseEvent( property );
                }
            });
        }
    }

    // Characteristic.On
    function characteristic_On(service) {
        booleanCharacteristic(service, 'on', Characteristic.On, config.topics.setOn, config.topics.getOn, null, null, config.turnOffAfterms, config.resetStateAfterms, true);
    }

    // History for On (Eve-only)
    function history_On(historySvc, service) {
        characteristic_LastActivation(historySvc, service);

        // get characteristic to be logged
        var charac = service.getCharacteristic(Characteristic.On);
        // attach change callback for this characteristic
        charac.on('change', function (obj) {
            var logEntry = {
                time: Math.floor(Date.now() / 1000),  // seconds (UTC)
                status: (obj.newValue ? 1 : 0)  // fakegato-history logProperty 'status' for switch
            };
            historySvc.addEntry(logEntry);
            // update Eve's Characteristic.LastActivation
            state.lastActivation = logEntry.time - historySvc.getInitialTime();
            service.updateCharacteristic(Eve.Characteristics.LastActivation, state.lastActivation); 
        });
    }    

    // Characteristic.Brightness
    function characteristic_Brightness(service) {
        integerCharacteristic(service, 'brightness', Characteristic.Brightness, config.topics.setBrightness, config.topics.getBrightness);
    }

    // Characteristic.Hue
    function characteristic_Hue(service) {
        integerCharacteristic(service, 'hue', Characteristic.Hue, config.topics.setHue, config.topics.getHue);
    }

    // Characteristic.Saturation
    function characteristic_Saturation(service) {
        integerCharacteristic(service, 'saturation', Characteristic.Saturation, config.topics.setSaturation, config.topics.getSaturation);
    }

    // Characteristic.ColorTemperature
    function characteristic_ColorTemperature( service ) {
        integerCharacteristic( service, 'colorTemperature', Characteristic.ColorTemperature, config.topics.setColorTemperature, config.topics.getColorTemperature );
    }

    // Characteristic.OutletInUse
    function characteristic_OutletInUse(service) {
        booleanCharacteristic(service, 'outletInUse', Characteristic.OutletInUse, null, config.topics.getInUse);
    }

    // Characteristic.Name
    function characteristic_Name(service) {
        stringCharacteristic(service, 'name', Characteristic.Name, null, config.topics.getName, config.name);
    }

    // Characteristic.MotionDetected
    function characteristic_MotionDetected(service) {
        booleanCharacteristic(service, 'motionDetected', Characteristic.MotionDetected, null, config.topics.getMotionDetected, null, null, null, config.turnOffAfterms);
    }

    // Add Eve.Characteristics.LastActivation for History
    function characteristic_LastActivation(historySvc, service) {
        service.addOptionalCharacteristic(Eve.Characteristics.LastActivation); // to avoid warnings
        // get lastActivation time from history data (check 5s later to make sure the history is loaded)
        setTimeout( function() {
            if (historySvc.lastEntry && historySvc.memorySize) {
                let entry = historySvc.history[historySvc.lastEntry % historySvc.memorySize];
                if(entry && entry.hasOwnProperty('time')) {
                    let lastTime = entry.time - historySvc.getInitialTime();
                    addCharacteristic(service, 'lastActivation', Eve.Characteristics.LastActivation, lastTime);
                    log.debug('lastActivation time loaded');
                }
            }
        }, 5000);
    }

    // History for MotionDetected 
    function history_MotionDetected(historySvc, service) {
        var historyMergeTimer = null;
        characteristic_LastActivation(historySvc, service);

        // get characteristic to be logged
        var charac = service.getCharacteristic(Characteristic.MotionDetected);
        // attach change callback for this characteristic
        charac.on('change', function (obj) {
            var logEntry = {
                time: Math.floor(Date.now() / 1000),  // seconds (UTC)
                status: (obj.newValue ? 1 : 0)  // fakegato-history logProperty 'status' for motion sensor
            };
            // update Eve's Characteristic.LastActivation
            state.lastActivation = logEntry.time - historySvc.getInitialTime();
            service.updateCharacteristic(Eve.Characteristics.LastActivation, state.lastActivation);

            let mergeInterval = config.historyOptions.mergeInterval*60000 || 0;
            if (logEntry.status) {    
                if (historyMergeTimer) {
                    // reset timer -> discard off-event
                    clearTimeout(historyMergeTimer);
                    historyMergeTimer = null;
                }
                historySvc.addEntry(logEntry);
            } else {
                if (historyMergeTimer) {
                    // reset timer
                    clearTimeout(historyMergeTimer);
                }
                if (mergeInterval > 0) {
                    // log off-event later (with original time),
                    // if there is no new on-event in the given time.
                    historyMergeTimer = setTimeout(function () {
                        historyMergeTimer = null;
                        historySvc.addEntry(logEntry);
                    }, mergeInterval);
                } else {
                    historySvc.addEntry(logEntry);
                }
            }
        });
    }

    // Characteristic.StatusActive
    function characteristic_StatusActive(service) {
        booleanCharacteristic(service, 'statusActive', Characteristic.StatusActive, null, config.topics.getStatusActive, true);
    }

    // Characteristic.StatusFault
    function characteristic_StatusFault(service) {
        booleanCharacteristic(service, 'statusFault', Characteristic.StatusFault, null, config.topics.getStatusFault);
    }

    // Characteristic.StatusTampered
    function characteristic_StatusTampered(service) {
        booleanCharacteristic(service, 'statusTampered', Characteristic.StatusTampered, null, config.topics.getStatusTampered);
    }

    // Characteristic.StatusLowBattery
    function characteristic_StatusLowBattery(service) {
        booleanCharacteristic(service, 'statusLowBattery', Characteristic.StatusLowBattery, null, config.topics.getStatusLowBattery);
    }

    // Characteristic.OccupancyDetected
    function characteristic_OccupancyDetected(service) {
        booleanCharacteristic(service, 'occupancyDetected', Characteristic.OccupancyDetected, null, config.topics.getOccupancyDetected, false, function (val) {
            return val ? Characteristic.OccupancyDetected.OCCUPANCY_DETECTED : Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;
        });
    }

    // Characteristic.CurrentAmbientLightLevel
    function characteristic_CurrentAmbientLightLevel(service) {
        floatCharacteristic(service, 'currentAmbientLightLevel', Characteristic.CurrentAmbientLightLevel,
            null, config.topics.getCurrentAmbientLightLevel, 0.0001);
    }

    // Characteristic.CurrentTemperature
    function characteristic_CurrentTemperature(service) {
        floatCharacteristic(service, 'currentTemperature', Characteristic.CurrentTemperature,
            null, config.topics.getCurrentTemperature, 0 );

        // configured temperature ranges
        if( ! tempRange( service, Characteristic.CurrentTemperature ) ) {
            // or (old behaviour) allow negative temperatures (down to -100)
            var characteristic = service.getCharacteristic( Characteristic.CurrentTemperature );
            characteristic.props.minValue = -100;
        }
    }

    // History for CurrentTemperature (Eve-only)
    function history_CurrentTemperature(historySvc) {
        if (config.topics.getCurrentTemperature) {
            // additional MQTT subscription instead of set-callback due to correct averaging:
            mqttSubscribe(config.topics.getCurrentTemperature, 'currentTemperature', function (topic, message) {
                var logEntry = {
                    time: Math.floor(Date.now() / 1000),  // seconds (UTC)
                    temp: parseFloat(message)  // fakegato-history logProperty 'temp' for temperature sensor
                };
                historySvc.addEntry(logEntry);
            });
        }
    }

    function tempRange( service, theCharacteristic ) {
        let customRangeSet = false;
        if( config.minTemperature !== undefined || config.maxTemperature !== undefined ) {
            customRangeSet = true;
            var characteristic = service.getCharacteristic( theCharacteristic );
            if( config.minTemperature !== undefined ) {
                characteristic.props.minValue = config.minTemperature;
            }
            if( config.maxTemperature !== undefined ) {
                characteristic.props.maxValue = config.maxTemperature;
            }
        }
        return customRangeSet;
    }

    // Characteristic.TargetTemperature
    function characteristic_TargetTemperature( service ) {
        floatCharacteristic( service, 'targetTemperature', Characteristic.TargetTemperature,
            config.topics.setTargetTemperature, config.topics.getTargetTemperature, 0 );

        // custom min/max
        tempRange( service, Characteristic.TargetTemperature );
    }

    // Characteristic.CoolingThresholdTemperature
    function characteristic_CoolingThresholdTemperature( service ) {
        floatCharacteristic( service, 'coolingThresholdTemperature', Characteristic.CoolingThresholdTemperature,
            config.topics.setCoolingThresholdTemperature, config.topics.getCoolingThresholdTemperature, 25 );

        tempRange( service, Characteristic.CoolingThresholdTemperature );
    }

    // Characteristic.HeatingThresholdTemperature
    function characteristic_HeatingThresholdTemperature( service ) {
        floatCharacteristic( service, 'heatingThresholdTemperature', Characteristic.HeatingThresholdTemperature,
            config.topics.setHeatingThresholdTemperature, config.topics.getHeatingThresholdTemperature, 20 );

        tempRange( service, Characteristic.HeatingThresholdTemperature );
    }
    
    // Characteristic.CurrentRelativeHumidity
    function characteristic_CurrentRelativeHumidity(service) {
        floatCharacteristic(service, 'currentRelativeHumidity', Characteristic.CurrentRelativeHumidity,
            null, config.topics.getCurrentRelativeHumidity, 0 );
    }

    // Characteristic.TargetRelativeHumidity
    function characteristic_TargetRelativeHumidity( service ) {
        floatCharacteristic( service, 'targetRelativeHumidity', Characteristic.TargetRelativeHumitity,
            config.topics.setTargetRelativeHumidity, config.toipcs.getTargetRelativeHumidity, 0 );
    }

    // History for CurrentRelativeHumidity (Eve-only)
    function history_CurrentRelativeHumidity(historySvc) {
        if (config.topics.getCurrentRelativeHumidity) {
            // additional MQTT subscription instead of set-callback due to correct averaging:
            mqttSubscribe(config.topics.getCurrentRelativeHumidity, 'currentRelativeHumidity', function (topic, message) {
                var logEntry = {
                    time: Math.floor(Date.now() / 1000),  // seconds (UTC)
                    humidity: parseFloat(message)  // fakegato-history logProperty 'humidity' for humidity sensor
                };                
                historySvc.addEntry(logEntry);
            });
        }
    }

    // Characteristic.characteristic_AirPressure (Eve-only)
    function characteristic_AirPressure(service) {
        floatCharacteristic(service, 'airPressure', Eve.Characteristics.AirPressure, null, config.topics.getAirPressure, 0 );
        // set characteristic Elevation for air pressure calibration (not used yet with MQTT)
        service.updateCharacteristic(Eve.Characteristics.Elevation, 100);
    }

    // History for AirPressure (Eve-only)
    function history_AirPressure(historySvc) {
        if (config.topics.getAirPressure) {
            // additional MQTT subscription instead of set-callback due to correct averaging:
            mqttSubscribe(config.topics.getAirPressure, 'airPressure', function (topic, message) {
                var logEntry = {
                    time: Math.floor(Date.now() / 1000),  // seconds (UTC)
                    pressure: parseFloat(message)  // fakegato-history logProperty 'pressure' for air pressure sensor
                };
                historySvc.addEntry(logEntry);
            });
        }
    }

    // Characteristic.WeatherCondition (Eve-only)
    function characteristic_WeatherCondition(service) {
        service.addOptionalCharacteristic(Eve.Characteristics.WeatherCondition); // to avoid warnings
        stringCharacteristic(service, 'weatherCondition', Eve.Characteristics.WeatherCondition, null, config.topics.getWeatherCondition, '-' );
    }

    // Characteristic.Rain1h (Eve-only)
    function characteristic_Rain1h(service) {
        service.addOptionalCharacteristic(Eve.Characteristics.Rain1h); // to avoid warnings
        integerCharacteristic(service, 'rain1h', Eve.Characteristics.Rain1h, null, config.topics.getRain1h);
    }

    // Characteristic.Rain24h (Eve-only)
    function characteristic_Rain24h(service) {
        service.addOptionalCharacteristic(Eve.Characteristics.Rain24h); // to avoid warnings
        integerCharacteristic(service, 'rain24h', Eve.Characteristics.Rain24h, null, config.topics.getRain24h);
    }

    // Characteristic.UVIndex (Eve-only)
    function characteristic_UVIndex(service) {
        service.addOptionalCharacteristic(Eve.Characteristics.UVIndex); // to avoid warnings
        integerCharacteristic(service, 'uvIndex', Eve.Characteristics.UVIndex, null, config.topics.getUVIndex);
    }

    // Characteristic.Visibility (Eve-only)
    function characteristic_Visibility(service) {
        service.addOptionalCharacteristic(Eve.Characteristics.Visibility); // to avoid warnings
        integerCharacteristic(service, 'visibility', Eve.Characteristics.Visibility, null, config.topics.getVisibility);
    }

    // Characteristic.WindDirection (Eve-only)
    function characteristic_WindDirection(service) {
        service.addOptionalCharacteristic(Eve.Characteristics.WindDirection); // to avoid warnings
        stringCharacteristic(service, 'windDirection', Eve.Characteristics.WindDirection, null, config.topics.getWindDirection, '-');
    }

    // Characteristic.WindSpeed (Eve-only)
    function characteristic_WindSpeed(service) {
        service.addOptionalCharacteristic(Eve.Characteristics.WindSpeed); // to avoid warnings
        floatCharacteristic(service, 'windSpeed', Eve.Characteristics.WindSpeed, null, config.topics.getWindSpeed, 0);
    }

    // Characteristic.ContactSensorState
    function characteristic_ContactSensorState(service) {
        booleanCharacteristic(service, 'contactSensorState', Characteristic.ContactSensorState,
            null, config.topics.getContactSensorState, false, function (val) {
                return val ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED;
            }, undefined, config.resetStateAfterms);
    }

    // History for ContactSensorState (Eve-only)
    function history_ContactSensorState(historySvc, service) {
        characteristic_LastActivation(historySvc, service);

        // get characteristic to be logged
        var charac = service.getCharacteristic(Characteristic.ContactSensorState);

        // counterFile for saving 'timesOpened' and 'resetTotal'
        const counterFile = historyCounterFile();
        function writeCounterFile () {
            let saveObj = {timesOpened: state.timesOpened, resetTotal: state.resetTotal};
            fs.writeFile(counterFile, JSON.stringify(saveObj), 'utf8', function (err) {
                if (err) {
                    log('Error: cannot write file to save timesOpened');
                }
            });
        }
        // load TimesOpened counter from counterFile
        fs.readFile(counterFile, 'utf8', function (err, data) {
            let cnt = 0;
            let res = Math.floor(Date.now() / 1000) - 978307200  // seconds since 01.01.2001
            if (err) {
                log.debug('No data loaded for TimesOpened');
            } else {
                cnt = JSON.parse(data).timesOpened;
                res = JSON.parse(data).resetTotal;
            }
            service.addOptionalCharacteristic(Eve.Characteristics.TimesOpened); // to avoid warnings
            addCharacteristic(service, 'timesOpened', Eve.Characteristics.TimesOpened, cnt);
            historySvc.addOptionalCharacteristic(Eve.Characteristics.ResetTotal); // to avoid warnings
            addCharacteristic(historySvc, 'resetTotal', Eve.Characteristics.ResetTotal, res, function() {
                state.timesOpened = 0; // reset counter
                service.updateCharacteristic(Eve.Characteristics.TimesOpened, 0);
                writeCounterFile();
                log("Reset TimesOpened to 0");
            });

            // these ones are necessary to display history for contact sensors
            service.addOptionalCharacteristic(Eve.Characteristics.OpenDuration); // to avoid warnings
            addCharacteristic(service, 'openDuration', Eve.Characteristics.OpenDuration, 0);
            service.addOptionalCharacteristic(Eve.Characteristics.ClosedDuration); // to avoid warnings
            addCharacteristic(service, 'closedDuration', Eve.Characteristics.ClosedDuration, 0);
            
            // attach change callback for this characteristic
            charac.on('change', function (obj) {
                var logEntry = {
                    time: Math.floor(Date.now() / 1000),  // seconds (UTC)
                    status: obj.newValue  // fakegato-history logProperty 'status' for contact sensor
                };
                // update Eve's Characteristic.LastActivation
                state.lastActivation = logEntry.time - historySvc.getInitialTime();
                service.updateCharacteristic(Eve.Characteristics.LastActivation, state.lastActivation);
                if (logEntry.status) {
                    // update Eve's Characteristic.TimesOpened 
                    state.timesOpened++;
                    service.updateCharacteristic(Eve.Characteristics.TimesOpened, state.timesOpened);
                    writeCounterFile();
                }
                historySvc.addEntry(logEntry);
            });
        });
    }

    // Characteristic.ProgrammableSwitchEvent
    function characteristic_ProgrammableSwitchEvent(service, property, getTopic, switchValues, restrictSwitchValues) {
        let values = switchValues;
        if (!values) {
            values = ['1', '2', 'L']; // 1 means SINGLE_PRESS, 2 means DOUBLE_PRESS, L means LONG_PRESS
        }
        multiCharacteristic(service, property, Characteristic.ProgrammableSwitchEvent, null, getTopic, values, null, true);
        if( restrictSwitchValues ) {
            let characteristic = service.getCharacteristic( Characteristic.ProgrammableSwitchEvent );
            characteristic.props.validValues = restrictSwitchValues;
        }
    }

    // Characteristic.Volume
    function characteristic_Volume(service) {
        floatCharacteristic(service, 'volume', Characteristic.Volume, config.topics.setVolume, config.topics.getVolume, 0);
    }

    // Characteristic.Mute
    function characteristic_Mute( service ) {
        booleanCharacteristic( service, 'mute', Characteristic.Mute, config.topics.setMute, config.topics.getMute, false );
    }

    // Characteristic.SecuritySystemCurrentState
    function characteristic_SecuritySystemCurrentState(service) {
        let values = config.currentStateValues;
        if (!values) {
            values = ['SA', 'AA', 'NA', 'D', 'T'];
        }
        multiCharacteristic(service, 'currentState', Characteristic.SecuritySystemCurrentState, null, config.topics.getCurrentState, values, Characteristic.SecuritySystemCurrentState.DISARMED);
    }

    // Characteristic.SecuritySystemTargetState
    function characteristic_SecuritySystemTargetState(service) {
        let values = config.targetStateValues;
        if (!values) {
            values = ['SA', 'AA', 'NA', 'D'];
        }
        multiCharacteristic(service, 'targetState', Characteristic.SecuritySystemTargetState, config.topics.setTargetState, config.topics.getTargetState, values, Characteristic.SecuritySystemTargetState.DISARM);
        if( config.restrictTargetState ) {
            let characteristic = service.getCharacteristic( Characteristic.SecuritySystemTargetState );
            characteristic.props.validValues = config.restrictTargetState;
        }
    }

    // Characteristic.SmokeDetected
    function characteristic_SmokeDetected(service) {
        booleanCharacteristic(service, 'smokeDetected', Characteristic.SmokeDetected,
            null, config.topics.getSmokeDetected, false, function (val) {
                return val ? Characteristic.SmokeDetected.SMOKE_DETECTED : Characteristic.SmokeDetected.SMOKE_NOT_DETECTED;
            }, undefined, config.resetStateAfterms);
    }

    // Characteristic.CurrentDoorState
    function characteristic_CurrentDoorState(service) {
        let values = config.doorCurrentValues || config.doorValues;
        if (!values) {
            values = ['O', 'C', 'o', 'c', 'S'];
        }
        multiCharacteristic(service, 'currentDoorState', Characteristic.CurrentDoorState, null, config.topics.getCurrentDoorState, values, Characteristic.CurrentDoorState.CLOSED);
    }

    function characteristic_SimpleCurrentDoorState( service, property, getTopic, initialValue, mapValueFunc ) {
        // set up characteristic
        var charac = service.getCharacteristic( Characteristic.CurrentDoorState );
        charac.on( 'get', function( callback ) {
            handleGetStateCallback( callback, mapValueFunc( state[ property ] ) );
        } );

        // property-changed handler
        let propChangedHandler = events.targetDoorState = function() {
            setTimeout( () => {
                charac.setValue( mapValueFunc( state[ property ] ), undefined, c_mySetContext );
            }, 1000 );
        };

        // set initial value
        state[ property ] = initialValue;
        propChangedHandler();

        // subscribe to get topic
        if( getTopic ) {
            mqttSubscribe( getTopic, property, function( topic, message ) {
                // determine whether this is an on or off value
                let newState = false; // assume off
                if( isRecvValueOn( message ) ) {
                    newState = true; // received on value so on
                } else if ( ! isRecvValueOff( message ) ) {
                    // received value NOT acceptable as 'off' so ignore message
                    return;
                }

                // if changed, set
                if( state[ property ] != newState ) {
                    state[ property ] = newState;
                    propChangedHandler();
                }
            } );
        }
    }

    // Characteristic.DoorMoving (mqttthing simplified state)
    function characteristic_DoorMoving( service ) {
        characteristic_SimpleCurrentDoorState( service, 'doorMoving', config.topics.getDoorMoving, false, ( isMoving ) => {
            if( isMoving ) {
                if( state.targetDoorState == Characteristic.TargetDoorState.OPEN ) {
                    return Characteristic.CurrentDoorState.OPENING;
                } else {
                    return Characteristic.CurrentDoorState.CLOSING;
                }
            } else {
                if( state.targetDoorState == Characteristic.TargetDoorState.OPEN ) {
                    return Characteristic.CurrentDoorState.OPEN;
                } else {
                    return Characteristic.CurrentDoorState.CLOSED;
                }
            }
        } );
    }

    // Characteristic.TargetDoorState
    function characteristic_TargetDoorState(service) {
        let values = config.doorTargetValues || config.doorValues;
        if (!values) {
            values = ['O', 'C'];
        }
        multiCharacteristic(service, 'targetDoorState', Characteristic.TargetDoorState, config.topics.setTargetDoorState, config.topics.getTargetDoorState, values, Characteristic.TargetDoorState.OPEN);
    }

    // Characteristic.ObstructionDetected
    function characteristic_ObstructionDetected(service) {
        booleanCharacteristic(service, 'obstructionDetected', Characteristic.ObstructionDetected, null, config.topics.getObstructionDetected, false);
    }

    // Characteristic.LockCurrentState
    function characteristic_LockCurrentState(service) {
        let values = config.lockValues;
        if( ! values ) {
            values = [ 'U', 'S', 'J', '?' ];
        }
        multiCharacteristic( service, 'lockCurrentState', Characteristic.LockCurrentState, null, config.topics.getLockCurrentState, values, Characteristic.LockCurrentState.UNSECURED );
    }

    // Characteristic.LockTargetState
    function characteristic_LockTargetState(service) {
        let values = config.lockValues;
        if( ! values ) {
            values = [ 'U', 'S' ];
        }
        multiCharacteristic( service, 'lockTargetState', Characteristic.LockTargetState, config.topics.setLockTargetState, config.topics.getLockTargetState, values, Characteristic.LockTargetState.UNSECURED );
    }

    // Characteristic.RotationDirection
    function characteristic_RotationDirection(service) {
        integerCharacteristic(service, 'rotationDirection', Characteristic.RotationDirection, config.topics.setRotationDirection, config.topics.getRotationDirection);
    }

    // Characteristic.RotationSpeed
    function characteristic_RotationSpeed(service) {
        integerCharacteristic(service, 'rotationSpeed', Characteristic.RotationSpeed, config.topics.setRotationSpeed, config.topics.getRotationSpeed);
    }

    // Characteristic.BatteryLevel
    function characteristic_BatteryLevel( service ) {
        integerCharacteristic( service, 'batteryLevel', Characteristic.BatteryLevel, null, config.topics.getBatteryLevel );
    }

    // Characteristic.ChargingState
    function characteristic_ChargingState( service ) {
        let values = config.chargingStateValues;
        if( ! values ) {
            values = [ 'NOT_CHARGING', 'CHARGING', 'NOT_CHARGEABLE' ];
        }
        multiCharacteristic( service, 'chargingState', Characteristic.ChargingState, null, config.topics.getChargingState, values, Characteristic.ChargingState.NOT_CHARGING );
    }

    // Characteristic.LeakDetected
    function characteristic_LeakDetected(service) {
        booleanCharacteristic(service, 'leakDetected', Characteristic.LeakDetected, null, config.topics.getLeakDetected, false, function (val) {
            return val ? Characteristic.LeakDetected.LEAK_DETECTED : Characteristic.LeakDetected.LEAK_NOT_DETECTED;
        }, undefined, config.resetStateAfterms );
    }

    // Characteristic.TargetPosition
    function characteristic_TargetPosition( service ) {
        integerCharacteristic( service, 'targetPosition', Characteristic.TargetPosition, config.topics.setTargetPosition, config.topics.getTargetPosition );
    }

    // Characteristic.CurrentPosition
    function characteristic_CurrentPosition( service ) {
        integerCharacteristic( service, 'currentPosition', Characteristic.CurrentPosition, null, config.topics.getCurrentPosition );
    }

    // Characteristic.PositionState
    function characteristic_PositionState( service ) {
        let values = config.positionStateValues;
        if( ! values ) {
            values = [ 'DECREASING', 'INCREASING', 'STOPPED' ];
        }
        multiCharacteristic( service, 'positionState', Characteristic.PositionState, null, config.topics.getPositionState, values, Characteristic.PositionState.STOPPED );
    }

    // Characteristic.HoldPosition
    function characteristic_HoldPosition( service ) {
        booleanCharacteristic( service, 'holdPosition', Characteristic.HoldPosition, config.topics.setHoldPosition, null, false );
    }

    // Characteristic.TargetHorizontalTiltAngle
    function Characteristic_TargetHorizontalTiltAngle( service ) {
        integerCharacteristic( service, 'targetHorizontalTiltAngle', Characteristic.TargetHorizontalTiltAngle, config.topics.setTargetHorizontalTiltAngle, config.topics.getTargetHorizontalTiltAngle );
    }

    // Characteristic.CurrentHorizontalTiltAngle
    function Characteristic_CurrentHorizontalTiltAngle( service ) {
        integerCharacteristic( service, 'currentHorizontalTiltAngle', Characteristic.CurrentHorizontalTiltAngle, null, config.topics.getCurrentHorizontalTiltAngle );
    }

    // Characteristic.TargetVerticalTiltAngle
    function Characteristic_TargetVerticalTiltAngle( service ) {
        integerCharacteristic( service, 'targetVerticalTiltAngle', Characteristic.TargetVerticalTiltAngle, config.topics.setTargetVerticalTiltAngle, config.topics.getTargetVerticalTiltAngle );
    }

    // Characteristic.CurrentVerticalTiltAngle
    function Characteristic_CurrentVerticalTiltAngle( service ) {
        integerCharacteristic( service, 'currentVerticalTiltAngle', Characteristic.CurrentVerticalTiltAngle, null, config.topics.getCurrentVerticalTiltAngle );
    }

    // Characteristic.AirQuality
    function characteristic_AirQuality( service ) {
        let values = config.airQualityValues;
        if( ! values ) {
            values = [ 'UNKNOWN', 'EXCELLENT', 'GOOD', 'FAIR', 'INFERIOR', 'POOR' ];
        }
        multiCharacteristic( service, 'airQuality', Characteristic.AirQuality, null, config.topics.getAirQuality, values, Characteristic.AirQuality.UNKNOWN );
    }

    // Characteristic.PM10Density
    function characteristic_PM10Density( service ) {
        floatCharacteristic( service, 'pm10density', Characteristic.PM10Density, null, config.topics.getPM10Density, Characteristic.PM10Density.UNKNOWN );
    }

    // Characteristic.PM2_5Density
    function characteristic_PM2_5Density( service ) {
        floatCharacteristic( service, 'pm2_5density', Characteristic.PM2_5Density, null, config.topics.getPM2_5Density, Characteristic.PM2_5Density.UNKNOWN );
    }

    // Characteristic.OzoneDensity
    function characteristic_OzoneDensity( service ) {
        floatCharacteristic( service, 'ozoneDensity', Characteristic.OzoneDensity, null, config.topics.getOzoneDensity );
    }

    // Characteristic.NitrogenDioxideDensity
    function characteristic_NitrogenDioxideDensity( service ) {
        floatCharacteristic( service, 'nitrogenDioxideDensity', Characteristic.NitrogenDioxideDensity, null, config.topics.getNitrogenDioxideDensity );
    }
    
    // Characteristic.SulphurDioxideDensity
    function characteristic_SulphurDioxideDensity( service ) {
        floatCharacteristic( service, 'sulphurDioxideDensity', Characteristic.SulphurDioxideDensity, null, config.topics.getSulphurDioxideDensity );
    }

    // Characteristic.VOCDensity
    function characteristic_VOCDensity( service ) {
        floatCharacteristic( service, 'VOCDensity', Characteristic.VOCDensity, null, config.topics.getVOCDensity );
    }

    // Characteristic.CarbonMonoxideDensity
    function characteristic_CarbonMonoxideLevel( service ) {
        floatCharacteristic( service, 'carbonMonoxideLevel', Characteristic.CarbonMonoxideLevel, null, config.topics.getCarbonMonoxideLevel );
    }
   
    // Eve.Characteristics.AirParticulateDensity (Eve-only)
    function characteristic_AirQualityPPM( service ) {
        service.addOptionalCharacteristic(Eve.Characteristics.AirParticulateDensity); // to avoid warnings
        floatCharacteristic( service, 'airQualityPPM', Eve.Characteristics.AirParticulateDensity, null, config.topics.getAirQualityPPM );
    }

    // History for Air Quality (Eve-only)
    function history_AirQualityPPM( historySvc ) {
        if (config.topics.getAirQualityPPM) {
            // additional MQTT subscription instead of set-callback due to correct averaging:
            mqttSubscribe(config.topics.getAirQualityPPM, 'airQualityPPM', function (topic, message) {
                var logEntry = {
                    time: Math.floor(Date.now() / 1000),  // seconds (UTC)
                    ppm: parseFloat(message)  // fakegato-history logProperty 'ppm' for air quality sensor
                };
                historySvc.addEntry(logEntry);
            });
        }
    }    

    // Characteristic.CarbonDioxideDetected
    function characteristic_CarbonDioxideDetected( service ) {
        let values = config.carbonDioxideDetectedValues;
        if( ! values ) {
            values = [ 'NORMAL', 'ABNORMAL' ];
        }
        multiCharacteristic( service, 'carbonDioxideDetected', Characteristic.CarbonDioxideDetected, null, config.topics.getCarbonDioxideDetected, values, Characteristic.CarbonDioxideDetected.CO2_LEVELS_NORMAL );
    }

    // Characteristic.CarbonDioxideLevel
    function characteristic_CarbonDioxideLevel( service ) {
        floatCharacteristic( service, 'carbonDioxideLevel', Characteristic.CarbonDioxideLevel, null, config.topics.getCarbonDioxideLevel, 0 );
    }

    // Characteristic.CarbonDioxideLevel
    function characteristic_CarbonDioxidePeakLevel( service ) {
        floatCharacteristic( service, 'carbonDioxidePeakLevel', Characteristic.CarbonDioxidePeakLevel, null, config.topics.getCarbonDioxidePeakLevel, 0 );
    }

    // Characteristic.CurrentHeatingCoolingState
    function characteristic_CurrentHeatingCoolingState( service ) {
        let values = config.heatingCoolingStateValues;
        if( ! values ) {
            values = [ 'OFF', 'HEAT', 'COOL' ];
        }
        multiCharacteristic( service, 'currentHeatingCoolingState', Characteristic.CurrentHeatingCoolingState, null, config.topics.getCurrentHeatingCoolingState, values, Characteristic.CurrentHeatingCoolingState.OFF );
    }

    // Characteristic.TargetHeatingCoolingState
    function characteristic_TargetHeatingCoolingState( service ) {
        let values = config.heatingCoolingStateValues;
        if( ! values ) {
            values = [ 'OFF', 'HEAT', 'COOL', 'AUTO' ];
        }
        multiCharacteristic( service, 'targetHeatingCoolingState', Characteristic.TargetHeatingCoolingState, config.topics.setTargetHeatingCoolingState, config.topics.getTargetHeatingCoolingState, values, Characteristic.TargetHeatingCoolingState.OFF );
        if( config.restrictHeatingCoolingState ) {
            let characteristic = service.getCharacteristic( Characteristic.TargetHeatingCoolingState );
            characteristic.props.validValues = config.restrictHeatingCoolingState;
        }
    }

    // Characteristic.CurrentHeaterCoolerState
    function characteristic_CurrentHeaterCoolerState( service ) {
        let values = config.currentHeaterCoolerValues;
        if( ! values ) {
            values = [ 'INACTIVE', 'IDLE', 'HEATING', 'COOLING' ];
        }
        multiCharacteristic( service, 'currentHeaterCoolerState', Characteristic.CurrentHeaterCoolerState, null, config.topics.getCurrentHeaterCoolerState, values, Characteristic.CurrentHeaterCoolerState.INACTIVE );
    }

    // Characteristic.TargetHeaterCoolerState
    function characteristic_TargetHeaterCoolerState( service ) {
        let values = config.targetHeaterCoolerValues;
        if( ! values ) {
            values = [ 'AUTO', 'HEAT', 'COOL' ];
        }
        multiCharacteristic( service, 'targetHeaterCoolerState', Characteristic.TargetHeaterCoolerState, config.topics.setTargetHeaterCoolerState, config.topics.getTargetHeaterCoolerState, values, Characteristic.TargetHeaterCoolerState.AUTO );
        if( config.restrictHeaterCoolerState ) {
            let characteristic = service.getCharacteristic( Characteristic.TargetHeaterCoolerState );
            characteristic.props.validValues = config.restrictHeaterCoolerState;
        }
    }

    // Characteristic.LockPhysicalControls
    function characteristic_LockPhysicalControls( service ) {
        let values = config.lockPhysicalControlsValues;
        if( ! values ) {
            values = [ 'DISABLED', 'ENABLED' ];
        }
        multiCharacteristic( service, 'lockPhysicalControls', Characteristic.LockPhysicalControls, config.topics.setLockPhysicalControls, config.topics.getLockPhysicalControls, values, Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED );
    }

    // Characteristic.SwingMode
    function characteristic_SwingMode( service ) {
        let values = config.swingModeValues;
        if( ! values ) {
            values = [ 'DISABLED', 'ENABLED' ];
        }
        multiCharacteristic( service, 'swingMode', Characteristic.SwingMode, config.topics.setSwingMode, config.topics.getSwingMode, values, Characteristic.SwingMode.DISABLED );
    }

    // Characteristic.TemperatureDisplayUnits
    function characteristic_TemperatureDisplayUnits( service ) {
        let values = config.temperatureDisplayUnitsValues;
        if( ! values ) {
            values = [ 'CELSIUS', 'FAHRENHEIT' ];
        }
        multiCharacteristic( service, 'temperatureDisplayUnits', Characteristic.TemperatureDisplayUnits, 
            config.topics.setTemperatureDisplayUnits, config.topics.getTemperatureDisplayUnits, values,
            Characteristic.TemperatureDisplayUnits.CELSIUS );
    }

    // Characteristic.ServiceLabelIndex
    function characteristic_ServiceLabelIndex( service, index ) {
        service.setCharacteristic(Characteristic.ServiceLabelIndex, index);
    }

    // Characteristic.ServiceLabelNamespace
    function characteristic_ServiceLabelNamespace( service ) {
        if (config.labelType === 'dots') {
            service.setCharacteristic(Characteristic.ServiceLabelNamespace, Characteristic.ServiceLabelNamespace.DOTS);
        } else if (config.labelType === 'numerals') {
            service.setCharacteristic(Characteristic.ServiceLabelNamespace, Characteristic.ServiceLabelNamespace.ARABIC_NUMERALS);
        } else {
            service.setCharacteristic(Characteristic.ServiceLabelNamespace, Characteristic.ServiceLabelNamespace.DOTS);
        }
    }

    // Eve.Characteristics.CurrentConsumption [Watts] (Eve-only)
    function characteristic_CurrentConsumption( service ) {
        service.addOptionalCharacteristic(Eve.Characteristics.CurrentConsumption); // to avoid warnings
        floatCharacteristic( service, 'currentConsumption', Eve.Characteristics.CurrentConsumption, null, config.topics.getWatts, 0 );
    }

    // Eve.Characteristics.Voltage [Volts] (Eve-only)
    function characteristic_Voltage( service ) {
        service.addOptionalCharacteristic(Eve.Characteristics.Voltage); // to avoid warnings
        floatCharacteristic( service, 'voltage', Eve.Characteristics.Voltage, null, config.topics.getVolts, 0 );
    }

    // Eve.Characteristics.ElectricCurrent [Amperes] (Eve-only)
    function characteristic_ElectricCurrent( service ) {
        service.addOptionalCharacteristic(Eve.Characteristics.ElectricCurrent); // to avoid warnings
        floatCharacteristic( service, 'electricCurrent', Eve.Characteristics.ElectricCurrent, null, config.topics.getAmperes, 0 );
    }

    // Eve.Characteristics.TotalConsumption [kWh] (Eve-only) - optional if there is an external energy counter 
    function characteristic_TotalConsumption( service ) {
        service.addOptionalCharacteristic(Eve.Characteristics.TotalConsumption); // to avoid warnings
        floatCharacteristic( service, 'totalConsumption', Eve.Characteristics.TotalConsumption, null, config.topics.getTotalConsumption, 0 );
    }

    // History for PowerConsumption (Eve-only)
    function history_PowerConsumption(historySvc, service) {
        // enable mqttthing energy counter, if there is no getTotalConsumption topic
        const energyCounter = config.topics.getTotalConsumption ? false : true;
        var lastLogEntry = {time: 0, power: 0};  // for energyCounter
        // counterFile for saving 'totalConsumption' and 'resetTotal'
        const counterFile = historyCounterFile();

        function writeCounterFile () {
            let saveObj = {totalConsumption: state.totalConsumption, resetTotal: state.resetTotal};
            fs.writeFile(counterFile, JSON.stringify(saveObj), 'utf8', function (err) {
                if (err) {
                    log('Error: cannot write file to save totalConsumption');
                }
            });
        }

        if (energyCounter) {
            // load TotalConsumption counter from counterFile
            fs.readFile(counterFile, 'utf8', function (err, data) {
                let cnt = 0;
                let res = Math.floor(Date.now() / 1000) - 978307200  // seconds since 01.01.2001
                if (err) {
                    log.debug('No data loaded for totalConsumption');
                } else {
                    cnt = JSON.parse(data).totalConsumption;
                    res = JSON.parse(data).resetTotal;
                }
                service.addOptionalCharacteristic(Eve.Characteristics.TotalConsumption); // to avoid warnings
                addCharacteristic(service, 'totalConsumption', Eve.Characteristics.TotalConsumption, cnt);
                historySvc.addOptionalCharacteristic(Eve.Characteristics.ResetTotal); // to avoid warnings
                addCharacteristic(historySvc, 'resetTotal', Eve.Characteristics.ResetTotal, res, function() {
                    state.totalConsumption = 0; // reset counter
                    service.updateCharacteristic(Eve.Characteristics.TotalConsumption, 0);
                    writeCounterFile();
                    log("Reset TotalConsumption to 0");
                });
            });
        }

        if (config.topics.getWatts) {
            // additional MQTT subscription instead of set-callback due to correct averaging:
            mqttSubscribe(config.topics.getWatts, 'watts', function (topic, message) {
                var logEntry = {
                    time: Math.floor(Date.now() / 1000),  // seconds (UTC)
                    power: parseFloat(message)  // fakegato-history logProperty 'power' for energy meter
                };
                if (energyCounter) {
                    // update Eve's Characteristic.TotalConsumption:
                    if (lastLogEntry.time) {
                        // energy counter: power * timeDifference (Ws --> kWh)
                        state.totalConsumption += lastLogEntry.power * (logEntry.time - lastLogEntry.time) / 1000 / 3600;
                    }
                    lastLogEntry.time = logEntry.time;
                    lastLogEntry.power = logEntry.power;
                    service.updateCharacteristic(Eve.Characteristics.TotalConsumption, state.totalConsumption);
                    writeCounterFile();
                }
                historySvc.addEntry(logEntry);
            });
        }
    }

    // Characteristic.Active
    function characteristic_Active( service ) {
        booleanCharacteristic(service, 'active', Characteristic.Active, config.topics.setActive, config.topics.getActive, false, function (val) {
            return val ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;
        }, config.turnOffAfterms);
    }

    // Characteristic.InUse
    function characteristic_InUse( service ) {
        booleanCharacteristic(service, 'inUse', Characteristic.InUse, null, config.topics.getInUse, false, function (val) {
            return val ? Characteristic.InUse.IN_USE : Characteristic.InUse.NOT_IN_USE;
        });
    }

    // Characteristic.SetDuration
    function characteristic_SetDuration( service ) {
        if ( !config.topics.setDuration ) { 
            addCharacteristic(service, 'setDuration', Characteristic.SetDuration, 10*60, function() {
                log.debug('set SetDuration to ' + state.setDuration + 's.');
            });
        } else {
            integerCharacteristic(service, 'setDuration', Characteristic.SetDuration, config.topics.setDuration, config.topics.getDuration, 10*60);

            // minimum/maximum duration
            if( config.minDuration !== undefined || config.maxDuration !== undefined ) {
                var charac = service.getCharacteristic( Characteristic.SetDuration );
                if( config.minDuration !== undefined ) {
                    charac.props.minValue = config.minDuration;
                }
                if( config.maxDuration !== undefined ) {
                    charac.props.maxValue = config.maxDuration;
                }
            }
        }
    }

    // Characteristic.RemainingDuration
    function characteristic_RemainingDuration( service ) {
        // Instead of saving the remaining duration, the time of the expected end is stored.
        // This makes it easier to respond to following GET queries from HomeKit.
        state.durationEndTime = Math.floor(Date.now() / 1000);

        function getRemainingDuration() {
            let remainingDuration = state.durationEndTime - Math.floor(Date.now() / 1000);
            return (state.active && remainingDuration > 0) ? remainingDuration : 0;
        }

        // set up characteristic
        var charac = service.addCharacteristic(Characteristic.RemainingDuration);
        charac.on('get', function (callback) {
            handleGetStateCallback( callback, getRemainingDuration() );
        });
        var characActive = service.getCharacteristic(Characteristic.Active);

        // duration timer function
        var durationTimer = null;
        function timerFunc() {
            durationTimer = null;
            state.active = false;
            mqttPublish( config.topics.setActive, 'active', getOnOffPubValue( false ) );
            characActive.updateValue( Characteristic.Active.INACTIVE );
        }

        // update durationEndTime once when 'Active' changes to ACTIVE
        if (service.testCharacteristic(Characteristic.SetDuration)) {
            if (config.durationTimer) {
                // add durationTimer (turn off timer)
                characActive.on('change', function (obj) {
                    if ( obj.newValue == Characteristic.Active.ACTIVE ) {
                        state.durationEndTime = Math.floor(Date.now() / 1000) + state.setDuration;
                        durationTimer = setTimeout( timerFunc, state.setDuration * 1000 );
                    } else {
                        if( durationTimer ) {
                            clearTimeout( durationTimer );
                        }
                    }
                    charac.updateValue( getRemainingDuration() );    
                });
            } else {
                // device will handle the timer by itself
                characActive.on('change', function (obj) {
                    if ( obj.newValue == Characteristic.Active.ACTIVE ) {
                        state.durationEndTime = Math.floor(Date.now() / 1000) + state.setDuration;
                    }
                    charac.updateValue( getRemainingDuration() );
                });
            }
        } else if (config.turnOffAfterms) {
            // no SetDuration Characteristic configured, but turnOffAfterms
            service.getCharacteristic(Characteristic.Active).on('change', function (obj) {
                if ( obj.newValue == Characteristic.Active.ACTIVE ) {
                    state.durationEndTime = Math.floor((Date.now() + config.turnOffAfterms) / 1000);
                }
                charac.updateValue( getRemainingDuration() );
            });
        }

        // update durationEndTime once when 'SetDuration' changes (if 'SetDuration' exists)
        if (service.testCharacteristic(Characteristic.SetDuration)) {
            service.getCharacteristic(Characteristic.SetDuration).on('change', function (obj) {
                // extend or shorten duration
                let maxEndTime = Math.floor(Date.now() / 1000) + obj.newValue;
                let newEndTime = state.durationEndTime + (obj.newValue - obj.oldValue);
                state.durationEndTime = (newEndTime < maxEndTime) ? newEndTime : maxEndTime;
                charac.updateValue( getRemainingDuration() );
                if( durationTimer ) {
                    // update timer
                    clearTimeout( durationTimer );
                    durationTimer = setTimeout( timerFunc, getRemainingDuration() * 1000 );
                }
            });
        }

        // subscribe to get topic, update remainingDuration
        if (config.topics.getRemainingDuration) {
            mqttSubscribe(config.topics.getRemainingDuration, 'remainingDuration', function (topic, message) {
                let remainingDuration = parseInt(message);
                state.durationEndTime = Math.floor(Date.now() / 1000) + remainingDuration;
                charac.updateValue( remainingDuration );
                if( durationTimer ) {
                    // update timer
                    clearTimeout( durationTimer );
                    durationTimer = setTimeout( timerFunc, remainingDuration * 1000 );
                }
            });
        }
    }

    // Characteristic.ValveType
    function characteristic_ValveType( service ) {
        if (config.valveType === 'sprinkler') {
            service.setCharacteristic(Characteristic.ValveType, Characteristic.ValveType.IRRIGATION);
        } else if (config.valveType === 'shower') {
            service.setCharacteristic(Characteristic.ValveType, Characteristic.ValveType.SHOWER_HEAD);
        } else if (config.valveType === 'faucet') {
            service.setCharacteristic(Characteristic.ValveType, Characteristic.ValveType.WATER_FAUCET);
        } else {
            service.setCharacteristic(Characteristic.ValveType, Characteristic.ValveType.GENERIC_VALVE);
        }
    }

    // Characteristic.ActiveIdentifier
    function characteristic_ActiveIdentifier( service, values ) {
        multiCharacteristic( service, 'activeIdentifier', Characteristic.ActiveIdentifier, config.topics.setActiveInput, config.topics.getActiveInput, values, 0 );
    }

    // Characteristic.RemoteKey
    function characteristic_RemoteKey( service ) {
        let values = config.remoteKeyValues;
        if( ! values ) {
            values = [ 'REWIND', 'FAST_FORWARD', 'NEXT_TRACK', 'PREVIOUS_TRACK', 'UP', 'DOWN', 'LEFT', 'RIGHT', 
                'SELECT', 'BACK', 'EXIT', 'PLAY_PAUSE', '12', '13', '14', 'INFO' ];
        }
        multiCharacteristic( service, 'remoteKey', Characteristic.RemoteKey, config.topics.setRemoteKey, undefined, values, null, true );
    }

    // add optional sensor characteristics
    function addSensorOptionalCharacteristics(service) {
        if (config.topics.getStatusActive) {
            characteristic_StatusActive(service);
        }
        if (config.topics.getStatusFault) {
            characteristic_StatusFault(service);
        }
        if (config.topics.getStatusTampered) {
            characteristic_StatusTampered(service);
        }
        if (config.topics.getStatusLowBattery) {
            characteristic_StatusLowBattery(service);
        }
    }
    
    // Create accessory information service
    function makeAccessoryInformationService() {
        var informationService = new Service.AccessoryInformation();

        informationService.setCharacteristic( Characteristic.Manufacturer, config.manufacturer || "mqttthing" );
        informationService.setCharacteristic( Characteristic.Model, config.model || config.type );
        informationService.setCharacteristic( Characteristic.SerialNumber, config.serialNumber || ( os.hostname() + "-" + config.name ) );
        informationService.setCharacteristic( Characteristic.FirmwareRevision, config.firmwareRevision || packagedef.version );

        return informationService;
    }

    // Create service
    function createServices() {

        var name = config.name;
        var svcNames = config.serviceNames || {}; // custom names for multi-service accessories

        var service = null; // to return a single service
        var services = null; // if returning multiple services

        //  config.type may be 'type-subtype', e.g. 'lightbulb-OnOff'
        let configType = config.type.split('-')[0]; // ignore configuration subtype

        if (configType == "lightbulb") {
            service = new Service.Lightbulb(name);
            if( config.topics.setHSV ) {
                characteristics_HSVLight(service);
            } else if( config.topics.setRGB || config.topics.setRGBW || config.topics.setRGBWW ) {
                characteristics_RGBLight(service);
            } else if( config.topics.setWhite ) {
                characteristics_WhiteLight( service );
            } else {
                characteristic_On(service);
                if (config.topics.setBrightness) {
                    characteristic_Brightness(service);
                }
                if (config.topics.setHue) {
                    characteristic_Hue(service);
                }
                if (config.topics.setSaturation) {
                    characteristic_Saturation(service);
                }
                if( config.topics.setColorTemperature ) {
                    characteristic_ColorTemperature( service );
                }
            }
        } else if (configType == "switch") {
            service = new Service.Switch(name);
            characteristic_On(service);
            services = [service];
            if (config.history) {
                let historyOptions = new HistoryOptions();
                let historySvc = new HistoryService('switch', {displayName: name, log: log}, historyOptions);
                history_On(historySvc, service);
                // return history service too
                services.push( historySvc );
            }
        } else if (configType == "outlet") {
            service = new Service.Outlet(name);
            characteristic_On(service);
            if (config.topics.getInUse) {
                characteristic_OutletInUse(service);
            }
            if (config.topics.getWatts) {
                characteristic_CurrentConsumption(service);
            }
            if (config.topics.getVolts) {
                characteristic_Voltage(service);
            }
            if (config.topics.getAmperes) {
                characteristic_ElectricCurrent(service);
            }
            if (config.topics.getTotalConsumption) {
                characteristic_TotalConsumption(service);
            }
            services = [service];
            if (config.history) {
                let historyOptions = new HistoryOptions();
                let historySvc = new HistoryService('energy', {displayName: name, log: log}, historyOptions);
                history_PowerConsumption(historySvc, service);
                // return history service too
                services.push( historySvc );
            }
        } else if (configType == "motionSensor") {
            service = new Service.MotionSensor(name);
            characteristic_MotionDetected(service);
            services = [service];
            if (config.history) {
                let historyOptions = new HistoryOptions(true);
                let historySvc = new HistoryService('motion', {displayName: name, log: log}, historyOptions);
                history_MotionDetected(historySvc, service);
                // return history service too
                services.push( historySvc );
            }
            addSensorOptionalCharacteristics(service);
        } else if (configType == "occupancySensor") {
            service = new Service.OccupancySensor(name);
            characteristic_OccupancyDetected(service);
            addSensorOptionalCharacteristics(service);
        } else if (configType == "lightSensor") {
            service = new Service.LightSensor(name);
            characteristic_CurrentAmbientLightLevel(service);
            addSensorOptionalCharacteristics(service);
        } else if (configType == "temperatureSensor") {
            service = new Service.TemperatureSensor(name);
            characteristic_CurrentTemperature(service);
            addSensorOptionalCharacteristics(service);
            services = [service];
            if (config.history) {
                let historyOptions = new HistoryOptions();
                let historySvc = new HistoryService('weather', {displayName: name, log: log}, historyOptions);
                history_CurrentTemperature(historySvc);
                // return history service too
                services.push( historySvc );
            }
        } else if (configType == "humiditySensor") {
            service = new Service.HumiditySensor(name);
            characteristic_CurrentRelativeHumidity(service);
            addSensorOptionalCharacteristics(service);
            services = [service];
            if (config.history) {
                let historyOptions = new HistoryOptions();
                let historySvc = new HistoryService('weather', {displayName: name, log: log}, historyOptions);
                history_CurrentRelativeHumidity(historySvc);
                // return history service too
                services.push( historySvc );
            }
        } else if (configType == "airPressureSensor") {
            service = new Eve.Services.AirPressureSensor(name);
            characteristic_AirPressure(service);
            addSensorOptionalCharacteristics(service);
            services = [service];
            if (config.history) {
                let historyOptions = new HistoryOptions();
                let historySvc = new HistoryService('weather', {displayName: name, log: log}, historyOptions);
                history_AirPressure(historySvc);
                // return history service too
                services.push( historySvc );
            }
        } else if (configType == "weatherStation") {
            service = new Service.TemperatureSensor( svcNames.temperature || name + " Temperature");
            characteristic_CurrentTemperature( service );
            addSensorOptionalCharacteristics( service );
            services = [service];
            if( config.topics.getCurrentRelativeHumidity ) {
                let humSvc = new Service.HumiditySensor( svcNames.humidity || name + " Humidity" );
                characteristic_CurrentRelativeHumidity( humSvc );
                addSensorOptionalCharacteristics( humSvc );
                services.push( humSvc );
            }
            if( config.topics.getAirPressure ) {
                let presSvc = new Eve.Services.AirPressureSensor( svcNames.airPressure || name + " AirPressure" );
                characteristic_AirPressure( presSvc );
                addSensorOptionalCharacteristics( presSvc );
                services.push( presSvc );
            }
            // custom service UUID for optional Eve characteristics
            let weatherSvc = new Service( svcNames.weather || name + " Weather", "D92D5391-92AF-4824-AF4A-356F25F25EA1");
            let addWeatherSvc = false;
            if( config.topics.getWeatherCondition ) {
                characteristic_WeatherCondition( weatherSvc );
                addWeatherSvc = true;
            }
            if( config.topics.getRain1h ) {
                characteristic_Rain1h( weatherSvc );
                addWeatherSvc = true;
            }
            if( config.topics.getRain24h ) {
                characteristic_Rain24h( weatherSvc );
                addWeatherSvc = true;
            }
            if( config.topics.getUVIndex ) {
                characteristic_UVIndex( weatherSvc );
                addWeatherSvc = true;
            }
            if( config.topics.getVisibility ) {
                characteristic_Visibility( weatherSvc );
                addWeatherSvc = true;
            }
            if( config.topics.getWindDirection ) {
                characteristic_WindDirection( weatherSvc );
                addWeatherSvc = true;
            }
            if( config.topics.getWindSpeed ) {
                characteristic_WindSpeed( weatherSvc );
                addWeatherSvc = true;
            }
            if ( addWeatherSvc ) {
                services.push( weatherSvc );
            }
            if (config.history) {
                let historyOptions = new HistoryOptions();
                let historySvc = new HistoryService('weather', {displayName: name, log: log}, historyOptions);
                history_CurrentTemperature( historySvc );
                history_CurrentRelativeHumidity( historySvc );
                history_AirPressure( historySvc );
                services.push( historySvc );
            }
        } else if (configType == "contactSensor") {
            service = new Service.ContactSensor(name);
            characteristic_ContactSensorState(service);
            addSensorOptionalCharacteristics(service);
            services = [service];
            if (config.history) {
                let historyOptions = new HistoryOptions(true);
                let historySvc = new HistoryService('door', {displayName: name, log: log}, historyOptions);
                history_ContactSensorState(historySvc, service);
                // return history service too
                services.push( historySvc );
            }
        } else if (configType == "doorbell") {
            service = new Service.Doorbell(name);
            characteristic_ProgrammableSwitchEvent(service, 'switch', config.topics.getSwitch, config.switchValues, config.restrictSwitchValues);
            if (config.topics.setBrightness || config.topics.getBrightness) {
                characteristic_Brightness(service);
            }
            if (config.topics.setVolume || config.topics.getVolume) {
                characteristic_Volume(service);
            }
            services = [service];
            if( config.topics.getMotionDetected ) {
                // also create motion sensor
                let motionsvc = new Service.MotionSensor(svcNames.motion || name + '-motion' );
                characteristic_MotionDetected(motionsvc);
                // return motion sensor too
                services.push( motionsvc );
            }
        } else if( configType == "statelessProgrammableSwitch" ) {
            if (Array.isArray(config.topics.getSwitch)) {
                service = new Service.ServiceLabel(name);
                characteristic_ServiceLabelNamespace( service );
                services = [service]
                var i = 0;
                for (i = 0; i < config.topics.getSwitch.length; i++) {
                    let buttonTopic = config.topics.getSwitch[i];
                    let switchValues = config.switchValues;
                    if( switchValues ) {
                        if (Array.isArray(config.switchValues[0])) {
                            if (config.switchValues.length > i) {
                                switchValues = config.switchValues[i];
                            } else {
                                // If array is not long enough, just use the first entry
                                switchValues = config.switchValues[0];
                            }
                        }
                    }
                    let restrictSwitchValues = config.restrictSwitchValues;
                    if( restrictSwitchValues ) {
                        if (Array.isArray(config.restrictSwitchValues[0])) {
                            if (config.restrictSwitchValues.length > i) {
                                restrictSwitchValues = config.restrictSwitchValues[i];
                            } else {
                                // If array is not long enough, just use the first entry
                                restrictSwitchValues = config.restrictSwitchValues[0];
                            }
                        }
                    }
                    let buttonSvc = new Service.StatelessProgrammableSwitch( name + " " + i, i + 1 );
                    characteristic_ProgrammableSwitchEvent(buttonSvc, 'switch' + i, buttonTopic, switchValues, restrictSwitchValues);
                    characteristic_ServiceLabelIndex( buttonSvc, i + 1 );
                    services.push(buttonSvc)
                }
            } else {
                service = new Service.StatelessProgrammableSwitch( name );
                characteristic_ProgrammableSwitchEvent(service, 'switch', config.topics.getSwitch, config.switchValues, config.restrictSwitchValues);
            }
        } else if (configType == "securitySystem") {
            service = new Service.SecuritySystem(name);
            characteristic_SecuritySystemTargetState(service);
            characteristic_SecuritySystemCurrentState(service);
            if (config.topics.getStatusFault) {
                characteristic_StatusFault(service);
            }
            if (config.topics.getStatusTampered) {
                characteristic_StatusTampered(service);
            }
            // todo: SecuritySystemAlarmType
        } else if (configType == "smokeSensor") {
            service = new Service.SmokeSensor(name);
            characteristic_SmokeDetected(service);
            addSensorOptionalCharacteristics(service);
        } else if( configType == "garageDoorOpener" ) {
            service = new Service.GarageDoorOpener(name);
            characteristic_TargetDoorState(service);
            if( config.topics.getDoorMoving ) {
                characteristic_DoorMoving(service);
            } else {
                characteristic_CurrentDoorState(service);
            }
            characteristic_ObstructionDetected(service);
            if( config.topics.setLockTargetState ) {
                characteristic_LockTargetState(service);
            }
            if( config.topics.getLockCurrentState ) {
                characteristic_LockCurrentState(service);
            }
        } else if( configType == "lockMechanism" ) {
            service = new Service.LockMechanism( name );
            if( config.topics.setLockTargetState ) {
                characteristic_LockTargetState( service );
            }
            if( config.topics.getLockCurrentState ) {
                characteristic_LockCurrentState( service );
            }
        } else if( configType == "fan" ) {
            service = new Service.Fan(name);
            characteristic_On(service);
            if( config.topics.getRotationDirection || config.topics.setRotationDirection ) {
                characteristic_RotationDirection(service);
            }
            if( config.topics.getRotationSpeed || config.topics.setRotationSpeed ) {
                characteristic_RotationSpeed(service);
            }
        } else if( configType == "leakSensor" ) { 
            service = new Service.LeakSensor( name );
            characteristic_LeakDetected( service );
            addSensorOptionalCharacteristics(service);
        } else if( configType == "microphone" ) {
            service = new Service.Microphone( name );
            characteristic_Mute( service );
            if (config.topics.setVolume || config.topics.getVolume) {
                characteristic_Volume(service);
            }
        } else if( configType == "speaker" ) {
            service = new Service.Speaker( name );
            characteristic_Mute( service );
            if (config.topics.setVolume || config.topics.getVolume) {
                characteristic_Volume(service);
            }
        } else if( configType == "windowCovering" ) {
            service = new Service.WindowCovering( name );
            characteristic_CurrentPosition( service );
            characteristic_TargetPosition( service );
            characteristic_PositionState( service );
            if( config.topics.setHoldPosition ) {
                characteristic_HoldPosition( service );
            }
            if( config.topics.getTargetHorizontalTiltAngle || config.topics.setTargetHorizontalTiltAngle ) {
                Characteristic_TargetHorizontalTiltAngle( service );
            }
            if( config.topics.getTargetVerticalTiltAngle || config.topics.setTargetVerticalTiltAngle ) {
                Characteristic_TargetVerticalTiltAngle( service );
            }
            if( config.topics.getCurrentHorizontalTiltAngle ) {
                Characteristic_CurrentHorizontalTiltAngle( service );
            }
            if( config.topics.getCurrentVerticalTiltAngle ) {
                Characteristic_CurrentVerticalTiltAngle( service );
            }
            if( config.topics.getObstructionDetected ) {
                characteristic_ObstructionDetected( service );
            }
        } else if( configType == "window" ) {
            service = new Service.Window( name );
            characteristic_CurrentPosition( service );
            characteristic_TargetPosition( service );
            characteristic_PositionState( service );
            if( config.topics.setHoldPosition ) {
                characteristic_HoldPosition( service );
            }
            if( config.topics.getObstructionDetected ) {
                characteristic_ObstructionDetected( service );
            }
        } else if( configType == "airQualitySensor" ) {
            service = new Service.AirQualitySensor( svcNames.airQuality || name );
            characteristic_AirQuality( service );
            addSensorOptionalCharacteristics( service );
            if( config.topics.getCarbonDioxideLevel ) {
                characteristic_CarbonDioxideLevel( service );
            }
            if( config.topics.getPM10Density ) {
                characteristic_PM10Density( service );
            }
            if( config.topics.getPM2_5Density ) {
                characteristic_PM2_5Density( service );
            }
            if( config.topics.getOzoneDensity ) {
                characteristic_OzoneDensity( service );
            }
            if( config.topics.getNitrogenDioxideDensity ) {
                characteristic_NitrogenDioxideDensity( service );
            }
            if( config.topics.getSulphurDioxideDensity ) {
                characteristic_SulphurDioxideDensity( service );
            }
            if( config.topics.getVOCDensity ) {
                characteristic_VOCDensity( service );
            }
            if( config.topics.getCarbonMonoxideLevel ) {
                characteristic_CarbonMonoxideLevel( service );
            }
            services = [service];
            if( config.topics.getCurrentTemperature ) {
                let tempSvc = new Service.TemperatureSensor( svcNames.temperature || name + "-Temperature" );
                characteristic_CurrentTemperature( tempSvc );
                addSensorOptionalCharacteristics( tempSvc );
                services.push( tempSvc );
            }
            if( config.topics.getCurrentRelativeHumidity ) {
                let humSvc = new Service.HumiditySensor( svcNames.humidity || name + "-Humidity" );
                characteristic_CurrentRelativeHumidity( humSvc );
                addSensorOptionalCharacteristics( humSvc );
                services.push( humSvc );
            }
            if (config.history) {
                let historyOptions = new HistoryOptions();
                let historySvc = new HistoryService( 'room', {displayName: name, log: log}, historyOptions );
                if( config.topics.getAirQualityPPM ) {
                    characteristic_AirQualityPPM( service );
                }
                history_AirQualityPPM( historySvc );
                history_CurrentTemperature( historySvc );
                history_CurrentRelativeHumidity( historySvc );
                services.push( historySvc );
            }
        } else if( configType == 'carbonDioxideSensor' ) {
            service = new Service.CarbonDioxideSensor( name );
            characteristic_CarbonDioxideDetected( service );
            addSensorOptionalCharacteristics(service);
            if( config.topics.getCarbonDioxideLevel ) {
                characteristic_CarbonDioxideLevel( service );
            }
            if( config.topics.getCarbonDioxidePeakLevel ) {
                characteristic_CarbonDioxidePeakLevel( service );
            }
        } else if( configType == 'valve' ) {
            service = new Service.Valve( name );
            characteristic_ValveType( service );
            characteristic_Active( service );
            characteristic_InUse( service );
            if ( config.topics.setDuration || config.durationTimer ) {
                characteristic_SetDuration( service );
                characteristic_RemainingDuration( service );
            } else if ( config.topics.getRemainingDuration || config.turnOffAfterms ) {
                characteristic_RemainingDuration( service );
            }
            addSensorOptionalCharacteristics( service );
        } else if( configType == 'thermostat' ) {
            service = new Service.Thermostat( name );
            characteristic_CurrentHeatingCoolingState( service );
            characteristic_TargetHeatingCoolingState( service );
            characteristic_CurrentTemperature( service );
            characteristic_TargetTemperature( service );
            characteristic_TemperatureDisplayUnits( service );
            if( config.topics.getCurrentRelativeHumidity ) {
                characteristic_CurrentRelativeHumidity( service );
            }
            if( config.topics.getTargetRelativeHumidity || config.topics.setTargetRelativeHumidity ) {
                characteristic_TargetRelativeHumidity( service );
            }
            if( config.topics.getCoolingThresholdTemperature || config.topics.setCoolingThresholdTemperature ) {
                characteristic_CoolingThresholdTemperature( service );
            }
            if( config.topics.getHeatingThresholdTemperature || config.topics.setHeatingThresholdTemperature ) {
                characteristic_HeatingThresholdTemperature( service );
            }
        } else if( configType == "heaterCooler" ) {
            service = new Service.HeaterCooler( name );
            characteristic_Active( service );
            characteristic_CurrentHeaterCoolerState( service );
            characteristic_TargetHeaterCoolerState( service );
            characteristic_CurrentTemperature( service );
            if( config.topics.setLockPhysicalControls || config.topics.getLockPhysicalControls ) {
                characteristic_LockPhysicalControls( service );
            }
            if( config.topics.getSwingMode || config.topics.setSwingMode ) {
                characteristic_SwingMode( service );
            }
            if( config.topics.getCoolingThresholdTemperature || config.topics.setCoolingThresholdTemperature ) {
                characteristic_CoolingThresholdTemperature( service );
            }
            if( config.topics.getHeatingThresholdTemperature || config.topics.setHeatingThresholdTemperature ) {
                characteristic_HeatingThresholdTemperature( service );
            }
            if( config.topics.getTemperatureDisplayUnits || config.topics.setTemperatureDisplayUnits ) {
                characteristic_TemperatureDisplayUnits( service );
            }
            if( config.topics.getRotationSpeed || config.topics.setRotationSpeed ) {
                characteristic_RotationSpeed(service);
            }
        } else if( configType == 'television' ) {
            service = new Service.Television( name );
            service.isPrimaryService = true;
            characteristic_Active( service );
            service.setCharacteristic(Characteristic.ActiveIdentifier, 0);
            service.setCharacteristic(Characteristic.ConfiguredName, name);
            service.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
            // service.setCharacteristic(Characteristic.Brightness, XXX);  // no impact?
            // service.setCharacteristic(Characteristic.ClosedCaptions, XXX);  // no impact?
            // service.setCharacteristic(Characteristic.CurrentMediaState, XXX);  // no impact?
            // service.setCharacteristic(Characteristic.TargetMediaState, XXX);  // no impact?
            // service.setCharacteristic(Characteristic.PictureMode, XXX);  // no impact?
            // service.addCharacteristic(Characteristic.PowerModeSelection);  // this would add a button in TV settings
            characteristic_RemoteKey( service );

            services = [ service ];

            if (config.inputs) {
                var inputValues = [ 'NONE' ];   // MQTT values for ActiveIdentifier
                var displayOrderTlvArray = [];  // for specific order instead of default alphabetical ordering
                config.inputs.forEach( function( input, index ) {
                    let inputId = index + 1;
                    let inputName = input.name || 'Input ' + inputId;
                    let inputSvc = new Service.InputSource( inputName, inputId );
                    inputSvc.isHiddenService = true;  // not sure if necessary
                    service.addLinkedService(inputSvc);  // inputSvc must be linked to main service
                    inputSvc.setCharacteristic(Characteristic.Identifier, inputId);
                    inputSvc.setCharacteristic(Characteristic.ConfiguredName, inputName);
                    inputSvc.setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED);  // necessary for input to appear
                    inputSvc.setCharacteristic(Characteristic.InputDeviceType, Characteristic.InputDeviceType.OTHER); // no impact?
                    inputSvc.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.OTHER); // no impact?
                    var visibilityStateProperty = 'input' + inputId + '-visible';
                    addCharacteristic(inputSvc, visibilityStateProperty, Characteristic.TargetVisibilityState, Characteristic.TargetVisibilityState.SHOWN, function() {
                        // change CurrentVisibilityState when TargetVisibilityState changes
                        inputSvc.setCharacteristic(Characteristic.CurrentVisibilityState, state[visibilityStateProperty]);
                    });
                    inputValues.push(input.value || inputId);
                    displayOrderTlvArray.push(1, 1, inputId);  // type = 1 ("Identifier"), length = 1 Byte, Identifier value
                    services.push(inputSvc);
                });
                characteristic_ActiveIdentifier( service, inputValues );  // for selecting inputs
                var displayOrderTlv = new Buffer.from(displayOrderTlvArray).toString('base64');
                service.setCharacteristic(Characteristic.DisplayOrder, displayOrderTlv);
            }
        } else {
            log("ERROR: Unrecognized type: " + configType);
        }

        if (service) {
            if (config.topics.getName) {
                characteristic_Name(service);
            }

            if( config.topics.getOnline ) {
                state_Online();
            }
        }

        // always use services array
        if( ! services ) {
            if( service ) {
                services = [ service ];
            } else {
                log( 'Error: No service(s) created for ' + name );
                return;
            }
        }

        // optional battery service
        if( config.topics.getBatteryLevel || config.topics.getChargingState ||
            ( config.topics.getStatusLowBattery && ! service.testCharacteristic(Characteristic.StatusLowBattery) ) ) {
            // also create battery service
            let batsvc = new Service.BatteryService( name + '-battery' );
            if( config.topics.getBatteryLevel ) {
                characteristic_BatteryLevel( batsvc );
            }
            if( config.topics.getChargingState ) {
                characteristic_ChargingState( batsvc );
            }
            if( config.topics.getStatusLowBattery ) {
                characteristic_StatusLowBattery( batsvc );
            }
            services.push( batsvc );
        }

        // accessory information service
        services.push( makeAccessoryInformationService() );

        // start-up publishing
        if( config.startPub ) {
            if( Array.isArray( config.startPub ) ) {
                // new format - [ { topic: x, message: y }, ... ]
                for( let entry of config.startPub ) {
                    if( entry.topic ) {
                        mqttPublish( entry.topic, 'startPub', entry.message || '' );
                    }
                }
            } else {
                // old format - object of topic->message
                for( let topic in config.startPub ) {
                    if( config.startPub.hasOwnProperty( topic ) ) {
                        let msg = config.startPub[ topic ];
                        mqttPublish( topic, 'startPub', msg );
                    }
                }
            }
        }

        return services;
    }

    // The service
    var services = [];
    try {
        services = createServices();
    } catch( ex ) {
        log( 'Exception while creating services: ' + ex );
    }

    // Our accessory instance
    var thing = {};

    // Return services
    thing.getServices = function () {
        return services || [];
    };

    return thing;
}

// Homebridge Entry point
module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Eve = new homebridgeLib.EveHomeKitTypes(homebridge);
    HistoryService = fakegatoHistory(homebridge);
    homebridgePath = homebridge.user.storagePath();

    homebridge.registerAccessory("homebridge-mqttthing", "mqttthing", makeThing);
}
