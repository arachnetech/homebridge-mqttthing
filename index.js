// MQTT Thing Accessory plugin for Homebridge
// A Homebridge plugin for serveral services, based on homebrige-mqtt-switch and homebridge-mqttlightbulb

/* eslint-disable object-property-newline */
/* eslint-disable no-plusplus */

'use strict'; // eslint-disable-line

var os = require( "os" );
var packagedef = require( './package.json' );
var homebridgeLib = require( 'homebridge-lib' );
var fakegatoHistory = require( 'fakegato-history' );
var fs = require( "fs" );
var path = require( "path" );
var mqttlib = require( './libs/mqttlib' );
const EventEmitter = require( 'events' );

var Service, Characteristic, Eve, HistoryService;
var homebridgePath;

function makeThing( log, accessoryConfig, api ) {

    // Create accessory information service
    function makeAccessoryInformationService() {
        var informationService = new Service.AccessoryInformation();

        informationService.setCharacteristic( Characteristic.Manufacturer, accessoryConfig.manufacturer || "mqttthing" );
        informationService.setCharacteristic( Characteristic.Model, accessoryConfig.model || accessoryConfig.type );
        informationService.setCharacteristic( Characteristic.SerialNumber, accessoryConfig.serialNumber || ( os.hostname() + "-" + accessoryConfig.name ) );
        informationService.setCharacteristic( Characteristic.FirmwareRevision, accessoryConfig.firmwareRevision || packagedef.version );

        return informationService;
    }

    //
    //  MQTT Wrappers
    //

    // Initialize MQTT client
    let ctx = { log, config: accessoryConfig, homebridgePath };
    try {
        mqttlib.init( ctx );
    } catch( ex ) {
        log.error( 'MQTT initialisation failed: ' + ex );
        return { getServices: () => [] };
    }

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
    };

    // Controllers
    let controllers = [];

    // Create services
    function createServices() {

        function configToServices( config ) {

            // Adaptive lighting support...

            // Our controller
            let adaptiveLightingController = null;
            let adaptiveLightingEmitter = new EventEmitter();

            // Test whether adaptive lighting is active
            let isAdaptiveLightingActive = () => adaptiveLightingController && adaptiveLightingController.isAdaptiveLightingActive();

            // Disable adaptive lighting (when user sets hue/saturation explicitly)
            let disableAdaptiveLighting = function( what ) {
                if( isAdaptiveLightingActive() ) {
                    log( `External control (${what}) disabling adaptive lighting` );
                    adaptiveLightingController.disableAdaptiveLighting();
                }
            };

            // Do we support adaptive lighting?
            let supportAdaptiveLighting = function() {
                return ( config.adaptiveLighting !== false ) && api.versionGreaterOrEqual && api.versionGreaterOrEqual( '1.3.0-beta.27' );
            };

            // Create adaptive lighting controller
            let addAdaptiveLightingController = function( service ) {
                if( adaptiveLightingController ) {
                    log.error( 'Logic error: Duplicate call to addAdaptiveLightingController() - ignoring' );
                    return;
                }
                log( 'Enabling adaptive lighting' );
                adaptiveLightingController = new api.hap.AdaptiveLightingController( service, {
                    controllerMode: api.hap.AdaptiveLightingControllerMode.AUTOMATIC
                } );
                controllers.push( adaptiveLightingController );
            };

            // Migrate old-style history options
            if( config.hasOwnProperty( 'history' ) ) {
                if( typeof config.history == 'object' ) {
                    config.historyOptions = config.history;
                    config.history = true;
                } else {
                    if( !config.hasOwnProperty( 'historyOptions' ) ) {
                        config.historyOptions = {};
                    }
                }
                // migrate negated options for config-ui-x defaults
                if( !config.historyOptions.hasOwnProperty( 'noAutoTimer' ) ) {
                    config.historyOptions.noAutoTimer = ( config.historyOptions.autoTimer === false );
                }
                if( !config.historyOptions.hasOwnProperty( 'noAutoRepeat' ) ) {
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
                const counterFile = path.join( historyPersistencePath(), os.hostname().split( "." )[ 0 ] + "_" + config.name + "_cnt_persist.json" );
                return counterFile;
            }

            const c_mySetContext = { mqttthing: '---my-set-context--' };

            // constructor for fakegato-history options
            function HistoryOptions( isEventSensor = false ) {
                // maximum size of stored data points
                this.size = config.historyOptions.size || 4032;
                // data will be stored in .homebridge or path specified with homebridge -U option
                this.storage = 'fs';
                if( config.historyOptions.persistencePath ) {
                    this.path = historyPersistencePath();
                }
                if( config.historyOptions.noAutoTimer === true || config.historyOptions.mergeInterval ) {
                    // disable averaging (and repeating) interval timer
                    // if mergeInterval is used, then autoTimer has to be deactivated (inconsistencies possible)
                    this.disableTimer = true;
                }
                // disable repetition (if no data was received in last interval)
                if( config.historyOptions.noAutoRepeat === true ) {
                    if( isEventSensor ) {
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

                if( config.otherValueOff ) {
                    if( !isRecvValueOn( mqttval ) ) {
                        // it's not the on value and we consider any other value to be off
                        return true;
                    }
                }

                let offval = getOnOffPubValue( false );

                if( offval === null ) {
                    // there is no off value
                    return false;
                }

                if( mqttval === offval || mqttval == ( offval + '' ) ) {
                    // off value match - it's definitely off
                    return true;
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

            function mapValueForHomebridge( val, mapValueFunc ) {
                if( mapValueFunc ) {
                    return mapValueFunc( val );
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

            function isSet( val ) {
                return val !== undefined && val !== null;
            }

            function isValid( charac, value ) {

                // if validation is disabled, accept anything
                if( config.validate === false ) {
                    return true;
                }

                const format = charac.props.format;
                if( format === 'int' || format === "uint8" || format == "uint16" || format == "uint32" ) {
                    if( !Number.isInteger( value ) ) {
                        log( `Ignoring invalid value [${value}] for ${charac.displayName} - not an integer` );
                        return false;
                    }
                    if( isSet( charac.props.minValue ) && value < charac.props.minValue ) {
                        log( `Ignoring invalid value [${value}] for ${charac.displayName} - below minimum (${charac.props.minValue})` );
                        return false;
                    }
                    if( isSet( charac.props.maxValue ) && value > charac.props.maxValue ) {
                        log( `Ignoring invalid value [${value}] for ${charac.displayName} - above maximum (${charac.props.maxValue})` );
                        return false;
                    }
                } else if( format === 'float' ) {
                    if( typeof value !== 'number' || isNaN( value ) ) {
                        log( `Ignoring invalid value [${value}] for ${charac.displayName} - not a number` );
                        return false;
                    }
                    if( isSet( charac.props.minValue ) && value < charac.props.minValue ) {
                        log( `Ignoring invalid value [${value}] for ${charac.displayName} - below minimum (${charac.props.minValue})` );
                        return false;
                    }
                    if( isSet( charac.props.maxValue ) && value > charac.props.maxValue ) {
                        log( `Ignoring invalid value [${value}] for ${charac.displayName} - above maximum (${charac.props.maxValue})` );
                        return false;
                    }
                } else if( format === 'bool' ) {
                    if( value !== true && value !== false ) {
                        log( `Ignoring invalid value [${value}] for ${charac.displayName} - not a Boolean` );
                        return false;
                    }
                } else if( format === 'string' ) {
                    if( typeof value !== 'string' ) {
                        log( `Ignoring invalid value [${value}] for ${charac.displayName} - not a string` );
                        return false;
                    }
                } else {
                    log( `Unable to validate ${charac.displayName}, format [${charac.props.format}] - ${JSON.stringify( charac )}` );
                }
                return true;
            }

            function setCharacteristic( charac, value ) {
                if( isValid( charac, value ) ) {
                    charac.setValue( value, undefined, c_mySetContext );
                }
            }

            function booleanCharacteristic( service, property, characteristic, setTopic, getTopic, initialValue, mapValueFunc, turnOffAfterms, resetStateAfterms, enableConfirmation ) {

                var publish = makeConfirmedPublisher( setTopic, getTopic, property, enableConfirmation );

                // auto-turn-off and reset-state timers
                var autoOffTimer = null;
                var autoResetStateTimer = null;

                // default state
                state[ property ] = ( initialValue ? true : false );

                // set up characteristic
                var charac = service.getCharacteristic( characteristic );
                charac.on( 'get', function( callback ) {
                    handleGetStateCallback( callback, state[ property ] );
                } );
                if( setTopic ) {
                    charac.on( 'set', function( value, callback, context ) {
                        if( context !== c_mySetContext ) {
                            state[ property ] = value;
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

                                state[ property ] = false;
                                publish( getOnOffPubValue( false ) );
                                setCharacteristic( charac, mapValueForHomebridge( false, mapValueFunc ) );

                            }, turnOffAfterms );
                        }
                    } );
                }
                if( initialValue ) {
                    setCharacteristic( charac, mapValueForHomebridge( initialValue, mapValueFunc ) );
                }

                // subscribe to get topic
                if( getTopic ) {
                    mqttSubscribe( getTopic, property, function( topic, message ) {
                        // determine whether this is an on or off value
                        let newState = false; // assume off
                        if( isRecvValueOn( message ) ) {
                            newState = true; // received on value so on
                        } else if( !isRecvValueOff( message ) ) {
                            // received value NOT acceptable as 'off' so ignore message
                            return;
                        }
                        // if it changed, set characteristic
                        if( state[ property ] != newState ) {
                            state[ property ] = newState;
                            setCharacteristic( charac, mapValueForHomebridge( newState, mapValueFunc ) );
                        }
                        // optionally reset state to OFF after a timeout
                        if( newState && resetStateAfterms ) {
                            if( autoResetStateTimer ) {
                                clearTimeout( autoResetStateTimer );
                            }
                            autoResetStateTimer = setTimeout( function() {
                                autoResetStateTimer = null;
                                state[ property ] = false;
                                setCharacteristic( charac, mapValueForHomebridge( false, mapValueFunc ) );
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

            function integerCharacteristic( service, property, characteristic, setTopic, getTopic, options ) {

                let initialValue = options && options.initialValue;
                let minValue = options && options.minValue;
                let maxValue = options && options.maxValue;

                // default state
                state[ property ] = initialValue || 0;

                // set up characteristic
                var charac = service.getCharacteristic( characteristic );

                // min/max
                if( Number.isInteger( minValue ) ) {
                    charac.props.minValue = minValue;
                }
                if( Number.isInteger( maxValue ) ) {
                    charac.props.maxValue = maxValue;
                }

                // get/set
                charac.on( 'get', function( callback ) {
                    handleGetStateCallback( callback, state[ property ] );
                } );

                let onSet = function( value, context ) {
                    if( context !== c_mySetContext ) {
                        state[ property ] = value;
                        if( setTopic ) {
                            mqttPublish( setTopic, property, value );
                        }
                    }
                    if( options && options.onSet ) {
                        options.onSet( value, context );
                    }
                };

                if( setTopic || ( options && options.onSet ) ) {
                    charac.on( 'set', function( value, callback, context ) {
                        onSet( value, context );
                        callback();
                    } );
                }
                if( initialValue ) {
                    setCharacteristic( charac, initialValue );
                }

                // subscribe to get topic
                if( getTopic ) {
                    mqttSubscribe( getTopic, property, function( topic, message ) {
                        var newState = parseInt( message );
                        if( state[ property ] != newState ) {
                            if( options && options.onMqtt ) {
                                options.onMqtt( newState );
                            }
                            // update state and characteristic
                            state[ property ] = newState;
                            setCharacteristic( charac, newState );
                        }
                    } );
                }

                return { onSet };
            }

            function addCharacteristic( service, property, characteristic, defaultValue, characteristicChanged, adaptiveEventName ) {

                state[ property ] = defaultValue;

                var charac = service.getCharacteristic( characteristic );

                setCharacteristic( charac, defaultValue );

                charac.on( 'get', function( callback ) {
                    let valReturned = state[ property ];
                    if( !isValid( charac, valReturned ) ) {
                        valReturned = defaultValue;
                    }
                    handleGetStateCallback( callback, valReturned );
                } );

                if( characteristicChanged ) {
                    charac.on( 'set', function( value, callback, context ) {
                        if( context !== c_mySetContext ) {
                            state[ property ] = value;
                            characteristicChanged();
                        }
                        callback();
                    } );

                    if( adaptiveEventName ) {
                        adaptiveLightingEmitter.addListener( adaptiveEventName, ( value ) => {
                            state[ property ] = value;
                            characteristicChanged();
                        } );
                    }
                }
            }

            function characteristics_HSVLight( service ) {

                let lastpubmsg = '';

                function publishNow() {
                    var bri = state.bri;
                    if( !config.topics.setOn && !state.on ) {
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
                    addCharacteristic( service, 'on', Characteristic.On, false, function() {
                        if( state.on && state.bri == 0 ) {
                            state.bri = 100;
                        }
                        publish();
                    } );
                }
                addCharacteristic( service, 'hue', Characteristic.Hue, 0, publish, 'hue' );
                addCharacteristic( service, 'sat', Characteristic.Saturation, 0, publish, 'saturation' );
                addCharacteristic( service, 'bri', Characteristic.Brightness, 100, function() {
                    if( state.bri > 0 && !state.on ) {
                        state.on = true;
                    }
                    publish();
                } );

                if( config.topics.getHSV ) {
                    mqttSubscribe( config.topics.getHSV, 'HSV', function( topic, message ) {
                        var comps = ( '' + message ).split( ',' );
                        if( comps.length == 3 ) {

                            var hue = parseInt( comps[ 0 ] );
                            var sat = parseInt( comps[ 1 ] );
                            var bri = parseInt( comps[ 2 ] );

                            if( !config.topics.setOn ) {
                                var on = bri > 0 ? 1 : 0;

                                if( on != state.on ) {
                                    state.on = on;
                                    setCharacteristic( service.getCharacteristic( Characteristic.On ), on );
                                }
                            }

                            if( hue != state.hue ) {
                                disableAdaptiveLighting( 'HSV hue' );

                                state.hue = hue;
                                //log( 'hue ' + hue );
                                setCharacteristic( service.getCharacteristic( Characteristic.Hue ), hue );
                            }

                            if( sat != state.sat ) {
                                disableAdaptiveLighting( 'HSV saturation' );

                                state.sat = sat;
                                //log( 'sat ' + sat );
                                setCharacteristic( service.getCharacteristic( Characteristic.Saturation ), sat );
                            }

                            if( bri != state.bri ) {
                                state.bri = bri;
                                //log( 'bri ' + bri );
                                setCharacteristic( service.getCharacteristic( Characteristic.Brightness ), bri );
                            }
                        }
                    } );
                }

                if( supportAdaptiveLighting() ) {
                    characteristic_ColorTemperature_Internal( service );
                }
            }

            /*
                   * HSV to RGB conversion from https://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately
                   * accepts parameters
                   * h  Object = {h:x, s:y, v:z}
                   * OR
                   * h, s, v
                   */
            function HSVtoRGB( h, s, v ) {
                var r, g, b, i, f, p, q, t;
                if( arguments.length === 1 ) {
                    s = h.s, v = h.v, h = h.h;
                }
                i = Math.floor( h * 6 );
                f = h * 6 - i;
                p = v * ( 1 - s );
                q = v * ( 1 - f * s );
                t = v * ( 1 - ( 1 - f ) * s );
                switch( i % 6 ) {
                    case 0: r = v, g = t, b = p; break;
                    case 1: r = q, g = v, b = p; break;
                    case 2: r = p, g = v, b = t; break;
                    case 3: r = p, g = q, b = v; break;
                    case 4: r = t, g = p, b = v; break;
                    case 5: r = v, g = p, b = q; break;
                }
                return {
                    r: Math.round( r * 255 ),
                    g: Math.round( g * 255 ),
                    b: Math.round( b * 255 )
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
            function RGBtoHSV( r, g, b ) {
                if( arguments.length === 1 ) {
                    g = r.g, b = r.b, r = r.r;
                }
                var max = Math.max( r, g, b ), min = Math.min( r, g, b ),
                    d = max - min,
                    h,
                    s = ( max === 0 ? 0 : d / max ),
                    v = max / 255;

                switch( max ) {
                    case min: h = 0; break;
                    case r: h = ( g - b ) + d * ( g < b ? 6 : 0 ); h /= 6 * d; break;
                    case g: h = ( b - r ) + d * 2; h /= 6 * d; break;
                    case b: h = ( r - g ) + d * 4; h /= 6 * d; break;
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
                    var comps = ( '' + rgb ).split( ',' );
                    if( comps.length == 3 ) {
                        return { r: comps[ 0 ], g: comps[ 1 ], b: comps[ 2 ] };
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
                let rgb = { r: rgbin.r * rgbsc, g: rgbin.g * rgbsc, b: rgbin.b * rgbsc };
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
                    warmWhiteRGB = decodeRGBCommaSeparatedString( config.warmWhite ) || { r: 255, g: 158, b: 61 };
                    coldWhiteRGB = decodeRGBCommaSeparatedString( config.coldWhite ) || { r: 204, g: 219, b: 255 };
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
                    if( !config.topics.setOn && !state.on ) {
                        bri = 0;
                    }
                    var rgb = ScaledHSVtoRGB( state.hue, state.sat, bri );
                    let orig_rgb = { ww: 0, cw: 0, ...rgb };

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
                        rgb.ww = Math.floor( warmFactor * 255 );
                        rgb.cw = Math.floor( coldFactor * 255 );
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

                        if( config.whiteMix === false || config.noWhiteMix === true ) {
                            if( ( rgb.ww > 0 || rgb.cw > 0 ) && ( rgb.r > 0 || rgb.g > 0 || rgb.b > 0 ) ) {
                                // mixing white and colours is not allowed on some devices
                                let redThreshold = ( config.redThreshold === undefined ) ? 15 : config.redThreshold;
                                let greenThreshold = ( config.greenThreshold === undefined ) ? 15 : config.greenThreshold;
                                let blueThreshold = ( config.blueThreshold === undefined ) ? 15 : config.blueThreshold;
                                if( rgb.r > redThreshold || rgb.g > greenThreshold || rgb.b > blueThreshold ) {
                                    // colour
                                    rgb = orig_rgb;
                                } else {
                                    // white
                                    rgb.r = 0;
                                    rgb.g = 0;
                                    rgb.b = 0;
                                }
                            }
                        }

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
                            if( config.switchWhites ) {
                                msg += ',' + rgb.cw + ',' + rgb.ww;
                            } else {
                                msg += ',' + rgb.ww + ',' + rgb.cw;
                            }
                        }
                    } else {
                        // hex
                        msg = hexPrefix + toHex( rgb.r ) + toHex( rgb.g ) + toHex( rgb.b );
                        if( whiteComp ) {
                            msg += toHex( rgb.w );
                        } else if( wwcwComps ) {
                            if( config.switchWhites ) {
                                msg += toHex( rgb.cw ) + toHex( rgb.ww );
                            } else {
                                msg += toHex( rgb.ww ) + toHex( rgb.cw );
                            }
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
                    addCharacteristic( service, 'on', Characteristic.On, false, function() {
                        if( state.on && state.bri == 0 ) {
                            state.bri = 100;
                        }
                        publish();
                    } );
                }
                addCharacteristic( service, 'hue', Characteristic.Hue, 0, publish, 'hue' );
                addCharacteristic( service, 'sat', Characteristic.Saturation, 0, publish, 'saturation' );
                addCharacteristic( service, 'bri', Characteristic.Brightness, 100, function() {
                    if( state.bri > 0 && !state.on ) {
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
                    var hue = Math.floor( hsv.h );
                    var sat = Math.floor( hsv.s );
                    var bri = Math.floor( hsv.v );

                    if( !config.topics.setOn ) {
                        var on = bri > 0 ? 1 : 0;

                        if( on != state.on ) {
                            state.on = on;
                            //log( 'on ' + on );
                            setCharacteristic( service.getCharacteristic( Characteristic.On ), on );
                        }
                    }

                    if( hue != state.hue ) {
                        disableAdaptiveLighting( 'calculated hue' );

                        state.hue = hue;
                        //log( 'hue ' + hue );
                        setCharacteristic( service.getCharacteristic( Characteristic.Hue ), hue );
                    }

                    if( sat != state.sat ) {
                        disableAdaptiveLighting( 'calculated saturation' );

                        state.sat = sat;
                        //log( 'sat ' + sat );
                        setCharacteristic( service.getCharacteristic( Characteristic.Saturation ), sat );
                    }

                    if( bri != state.bri ) {
                        state.bri = bri;
                        //log( 'bri ' + bri );
                        setCharacteristic( service.getCharacteristic( Characteristic.Brightness ), bri );
                    }
                }

                if( getTopic ) {
                    mqttSubscribe( getTopic, property, function( topic, message ) {
                        var ok = false;
                        var red, green, blue, white, warmWhite, coldWhite;
                        if( hexPrefix == null ) {
                            // comma-separated decimal
                            var comps = ( '' + message ).split( ',' );
                            if( comps.length == numComponents ) {
                                red = parseInt( comps[ 0 ] );
                                green = parseInt( comps[ 1 ] );
                                blue = parseInt( comps[ 2 ] );
                                if( whiteComp ) {
                                    white = parseInt( comps[ 3 ] );
                                } else if( wwcwComps ) {
                                    warmWhite = parseInt( comps[ 3 ] );
                                    coldWhite = parseInt( comps[ 4 ] );
                                    if( config.switchWhites ) {
                                        let temp = warmWhite;
                                        warmWhite = coldWhite;
                                        coldWhite = temp;
                                    }
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
                                        if( config.switchWhites ) {
                                            let temp = warmWhite;
                                            warmWhite = coldWhite;
                                            coldWhite = temp;
                                        }
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

                if( supportAdaptiveLighting() ) {
                    characteristic_ColorTemperature_Internal( service );
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
                    if( !state.on ) {
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

                addCharacteristic( service, 'on', Characteristic.On, false, function() {
                    if( state.on && state.bri == 0 ) {
                        state.bri = 100;
                    }
                    publish();
                } );

                addCharacteristic( service, 'bri', Characteristic.Brightness, 100, function() {
                    if( state.bri > 0 && !state.on ) {
                        state.on = true;
                    }

                    publish();
                } );

                if( config.topics.getWhite ) {
                    mqttSubscribe( config.topics.getWhite, 'white', function( topic, message ) {
                        var ok = false;
                        var white;
                        if( hexPrefix == null ) {
                            var comps = ( '' + message ).split( ',' );
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
                            let on = bri > 0 ? true : false;

                            if( on != state.on ) {
                                state.on = on;
                                setCharacteristic( service.getCharacteristic( Characteristic.On ), on );
                            }

                            if( bri != state.bri ) {
                                state.bri = bri;
                                setCharacteristic( service.getCharacteristic( Characteristic.Brightness ), bri );
                            }
                        }
                    } );
                }
            }

            function floatCharacteristic( service, property, characteristic, setTopic, getTopic, options ) {

                if( options === undefined ) {
                    options = {};
                } else if( typeof options === 'number' ) {
                    options = { initialValue: options };
                }
                let initialValue = options.initialValue || 0;

                // set up characteristic
                var charac = service.getCharacteristic( characteristic );

                if( options.minValue !== undefined ) {
                    charac.props.minValue = options.minValue;
                }

                if( options.maxValue !== undefined ) {
                    charac.props.maxValue = options.maxValue;
                }

                if( initialValue < charac.props.minValue ) {
                    initialValue = charac.props.minValue;
                }

                if( initialValue > charac.props.maxValue ) {
                    initialValue = charac.props.maxValue;
                }

                // default state
                state[ property ] = initialValue;

                // get/set
                charac.on( 'get', function( callback ) {
                    handleGetStateCallback( callback, state[ property ] );
                } );
                if( setTopic ) {
                    charac.on( 'set', function( value, callback, context ) {
                        if( context !== c_mySetContext ) {
                            state[ property ] = value;
                            mqttPublish( setTopic, property, value );
                        }
                        callback();
                    } );
                }
                if( initialValue ) {
                    setCharacteristic( charac, initialValue );
                }

                // subscribe to get topic
                if( getTopic ) {
                    mqttSubscribe( getTopic, property, function( topic, message ) {
                        var newState = parseFloat( message );
                        if( state[ property ] != newState ) {
                            state[ property ] = newState;
                            setCharacteristic( charac, newState );
                        }
                    } );
                }
            }

            function stringCharacteristic( service, property, characteristic, setTopic, getTopic, initialValue ) {
                // default state
                state[ property ] = initialValue ? initialValue : '';

                // set up characteristic
                var charac = service.getCharacteristic( characteristic );
                charac.on( 'get', function( callback ) {
                    handleGetStateCallback( callback, state[ property ] );
                } );
                if( setTopic ) {
                    charac.on( 'set', function( value, callback, context ) {
                        if( context !== c_mySetContext ) {
                            state[ property ] = value;
                            mqttPublish( setTopic, property, value );
                        }
                        callback();
                    } );
                }

                // subscribe to get topic
                if( getTopic ) {
                    mqttSubscribe( getTopic, property, function( topic, message ) {
                        var newState = message.toString();
                        if( state[ property ] !== newState ) {
                            state[ property ] = newState;
                            setCharacteristic( charac, newState );
                        }
                    } );
                }
            }

            function multiCharacteristic( service, property, characteristic, setTopic, getTopic, values, initialValue, eventOnly ) {
                // Values is an array of MQTT values indexed by <value of Homekit enumeration>.
                // Build map of MQTT values to homekit values
                var mqttToHomekit = {};
                for( let i = 0; i < values.length; i++ ) {
                    mqttToHomekit[ values[ i ] ] = i;
                }

                state[ property ] = initialValue;

                var charac = service.getCharacteristic( characteristic );

                // Homekit get
                if( !eventOnly ) {
                    charac.on( 'get', function( callback ) {
                        handleGetStateCallback( callback, state[ property ] );
                    } );
                }

                // Homekit set
                if( setTopic ) {
                    charac.on( 'set', function( value, callback, context ) {
                        if( context !== c_mySetContext ) {

                            if( typeof value === "boolean" ) {
                                value = value ? 1 : 0;
                            }

                            state[ property ] = value;
                            let mqttVal = values[ value ];
                            if( mqttVal !== undefined ) {
                                mqttPublish( setTopic, property, mqttVal );
                            }
                            raiseEvent( property );
                        }
                        callback();
                    } );
                }

                if( initialValue ) {
                    setCharacteristic( charac, initialValue );
                }

                // MQTT set (Homekit get)
                if( getTopic ) {
                    mqttSubscribe( getTopic, property, function( topic, message ) {
                        let data = message?.toString() ?? '';
                        let newState = mqttToHomekit[ data ];
                        if( newState !== undefined && ( eventOnly || state[ property ] != newState ) ) {
                            if( config.logMqtt ) {
                                log( `Received ${data} - ${property} state is now ${newState}` );
                            }
                            state[ property ] = newState;
                            setCharacteristic( charac, newState );
                            raiseEvent( property );
                        }
                        if( newState === undefined && config.logMqtt ) {
                            log( `Warning: ${property} received [${data}] which is not in configured values ${JSON.stringify( mqttToHomekit )}` );
                        }
                    } );
                }
            }

            // Characteristic.On
            function characteristic_On( service ) {
                booleanCharacteristic( service, 'on', Characteristic.On, config.topics.setOn, config.topics.getOn, null, null, config.turnOffAfterms, config.resetStateAfterms, true );
            }

            // History for On (Eve-only)
            function history_On( historySvc, service ) {
                characteristic_LastActivation( historySvc, service );

                // get characteristic to be logged
                var charac = service.getCharacteristic( Characteristic.On );
                // attach change callback for this characteristic
                charac.on( 'change', function( obj ) {
                    var logEntry = {
                        time: Math.floor( Date.now() / 1000 ),  // seconds (UTC)
                        status: ( obj.newValue ? 1 : 0 )  // fakegato-history logProperty 'status' for switch
                    };
                    historySvc.addEntry( logEntry );
                    // update Eve's Characteristic.LastActivation
                    state.lastActivation = logEntry.time - historySvc.getInitialTime();
                    service.updateCharacteristic( Eve.Characteristics.LastActivation, state.lastActivation );
                } );
            }

            // Characteristic.Brightness
            function characteristic_Brightness( service ) {

                if( config.topics.setOn ) {
                    // separate On topic, so implement standard brightness characteristic
                    integerCharacteristic( service, 'brightness', Characteristic.Brightness, config.topics.setBrightness, config.topics.getBrightness );
                } else {
                    // no separate On topic, so use Brightness 0 to indicate Off state...

                    // subscription
                    if( config.topics.getBrightness ) {
                        mqttSubscribe( config.topics.getBrightness, 'brightness', function( topic, message ) {
                            let newState = parseInt( message );
                            let newOn = ( newState != 0 );
                            if( state.brightness != newState || state.on != newOn ) {
                                if( newOn ) {
                                    state.brightness = newState;
                                    setCharacteristic( service.getCharacteristic( Characteristic.Brightness ), newState );
                                }
                                state.on = newOn;
                                setCharacteristic( service.getCharacteristic( Characteristic.On ), newState != 0 );
                            }
                        } );
                    }

                    // publishing (throttled)
                    let publishNow = function() {
                        let bri = state.brightness;
                        if( !config.topics.setOn && !state.on ) {
                            bri = 0;
                        }
                        mqttPublish( config.topics.setBrightness, 'brightness', bri );
                    };

                    let publish = () => throttledCall( publishNow, 'brightness_pub', 20 );

                    // Brightness characteristic
                    addCharacteristic( service, 'brightness', Characteristic.Brightness, 0, () => {
                        if( state.brightness > 0 && !state.on ) {
                            state.on = true;
                        }
                        publish();
                    } );

                    // On Characteristic
                    addCharacteristic( service, 'on', Characteristic.On, false, function() {
                        if( state.on && state.brightness == 0 ) {
                            state.brightness = 100;
                        }
                        publish();
                    } );
                }
            }

            // Characteristic.Hue
            function characteristic_Hue( service ) {
                let char = integerCharacteristic( service, 'hue', Characteristic.Hue, config.topics.setHue, config.topics.getHue, {
                    onMqtt: () => disableAdaptiveLighting( 'hue' )
                } );
                if( supportAdaptiveLighting() ) {
                    adaptiveLightingEmitter.addListener( 'hue', ( value ) => char.onSet( value ) );
                }
            }

            // Characteristic.Saturation
            function characteristic_Saturation( service ) {
                let char = integerCharacteristic( service, 'saturation', Characteristic.Saturation, config.topics.setSaturation, config.topics.getSaturation, {
                    onMqtt: () => disableAdaptiveLighting( 'saturation' )
                } );
                if( supportAdaptiveLighting() ) {
                    adaptiveLightingEmitter.addListener( 'saturation', ( value ) => char.onSet( value ) );
                }
            }

            // Characteristic.ColorTemperature
            function characteristic_ColorTemperature( service ) {
                integerCharacteristic( service, 'colorTemperature', Characteristic.ColorTemperature, config.topics.setColorTemperature, config.topics.getColorTemperature, {
                    initialValue: ( config.minColorTemperature || 140 ),
                    minValue: config.minColorTemperature,
                    maxValue: config.maxColorTemperature,
                    onMqtt: () => disableAdaptiveLighting( 'colorTemperature' )
                } );

                if( supportAdaptiveLighting() ) {
                    addAdaptiveLightingController( service );
                }
            }

            // 'Internal' Characteristic.ColorTemperature for adaptive lighting implementation
            function characteristic_ColorTemperature_Internal( service ) {
                integerCharacteristic( service, 'colorTemperature', Characteristic.ColorTemperature, null, null, {
                    initialValue: 140,
                    onSet: ( value ) => {
                        // update saturation and hue to match
                        let calc = api.hap.ColorUtils.colorTemperatureToHueAndSaturation( value );
                        service.getCharacteristic( Characteristic.Saturation ).updateValue( calc.saturation );
                        service.getCharacteristic( Characteristic.Hue ).updateValue( calc.hue );
                        adaptiveLightingEmitter.emit( 'saturation', calc.saturation );
                        adaptiveLightingEmitter.emit( 'hue', calc.hue );
                    }
                } );

                if( supportAdaptiveLighting() ) {
                    addAdaptiveLightingController( service );
                }
            }

            // Characteristic.OutletInUse
            function characteristic_OutletInUse( service ) {
                booleanCharacteristic( service, 'outletInUse', Characteristic.OutletInUse, null, config.topics.getInUse );
            }

            // Characteristic.Name
            function characteristic_Name( service ) {
                stringCharacteristic( service, 'name', Characteristic.Name, null, config.topics.getName, config.name );
            }

            // Characteristic.MotionDetected
            function characteristic_MotionDetected( service ) {
                booleanCharacteristic( service, 'motionDetected', Characteristic.MotionDetected, null, config.topics.getMotionDetected, null, null, null, config.turnOffAfterms );
            }

            // Add Eve.Characteristics.LastActivation for History
            function characteristic_LastActivation( historySvc, service ) {
                service.addOptionalCharacteristic( Eve.Characteristics.LastActivation ); // to avoid warnings
                // get lastActivation time from history data (check 5s later to make sure the history is loaded)
                setTimeout( function() {
                    if( historySvc.lastEntry && historySvc.memorySize ) {
                        let entry = historySvc.history[ historySvc.lastEntry % historySvc.memorySize ];
                        if( entry && entry.hasOwnProperty( 'time' ) ) {
                            let lastTime = entry.time - historySvc.getInitialTime();
                            addCharacteristic( service, 'lastActivation', Eve.Characteristics.LastActivation, lastTime );
                            log.debug( 'lastActivation time loaded' );
                        }
                    }
                }, 5000 );
            }

            // History for MotionDetected
            function history_MotionDetected( historySvc, service ) {
                var historyMergeTimer = null;
                characteristic_LastActivation( historySvc, service );

                // get characteristic to be logged
                var charac = service.getCharacteristic( Characteristic.MotionDetected );
                // attach change callback for this characteristic
                charac.on( 'change', function( obj ) {
                    var logEntry = {
                        time: Math.floor( Date.now() / 1000 ),  // seconds (UTC)
                        status: ( obj.newValue ? 1 : 0 )  // fakegato-history logProperty 'status' for motion sensor
                    };
                    // update Eve's Characteristic.LastActivation
                    state.lastActivation = logEntry.time - historySvc.getInitialTime();
                    service.updateCharacteristic( Eve.Characteristics.LastActivation, state.lastActivation );

                    let mergeInterval = config.historyOptions.mergeInterval * 60000 || 0;
                    if( logEntry.status ) {
                        if( historyMergeTimer ) {
                            // reset timer -> discard off-event
                            clearTimeout( historyMergeTimer );
                            historyMergeTimer = null;
                        }
                        historySvc.addEntry( logEntry );
                    } else {
                        if( historyMergeTimer ) {
                            // reset timer
                            clearTimeout( historyMergeTimer );
                        }
                        if( mergeInterval > 0 ) {
                            // log off-event later (with original time),
                            // if there is no new on-event in the given time.
                            historyMergeTimer = setTimeout( function() {
                                historyMergeTimer = null;
                                historySvc.addEntry( logEntry );
                            }, mergeInterval );
                        } else {
                            historySvc.addEntry( logEntry );
                        }
                    }
                } );
            }

            // Characteristic.StatusActive
            function characteristic_StatusActive( service ) {
                booleanCharacteristic( service, 'statusActive', Characteristic.StatusActive, null, config.topics.getStatusActive, true );
            }

            // Characteristic.StatusFault
            function characteristic_StatusFault( service ) {
                booleanCharacteristic( service, 'statusFault', Characteristic.StatusFault, null, config.topics.getStatusFault );
            }

            // Characteristic.StatusTampered
            function characteristic_StatusTampered( service ) {
                booleanCharacteristic( service, 'statusTampered', Characteristic.StatusTampered, null, config.topics.getStatusTampered );
            }

            // Characteristic.AltSensorState to help detecting triggered state with multiple sensors
            function characteristic_AltSensorState( /*service*/ ) {
                // additional MQTT subscription instead of set-callback due to correct averaging:
                mqttSubscribe( config.topics.getAltSensorState, 'AltSensorState', function( topic, message ) {
                    // determine whether this is an on or off value
                    let newState = false; // assume off
                    if( isRecvValueOn( message ) ) {
                        newState = true; // received on value so on
                    } else if( !isRecvValueOff( message ) ) {
                        // received value NOT acceptable as 'off' so ignore message
                        return;
                    }

                    // not a real property/state ??? - no property/propChangedHandler so disabling code below...
                    //  TODO: check with Ferme de Pommerieux
                    log.warn( `AltSensorState now ${newState ? 'on' : 'off'} - TODO: update state and set characteristic??` );

                    /*
                    // if changed, set
                    if( state[ property ] != newState ) {
                        state[ property ] = newState;
                        propChangedHandler();
                    }
                    */
                } );
            }

            // Characteristic.StatusLowBattery
            function characteristic_StatusLowBattery( service ) {
                booleanCharacteristic( service, 'statusLowBattery', Characteristic.StatusLowBattery, null, config.topics.getStatusLowBattery );
            }

            // Characteristic.OccupancyDetected
            function characteristic_OccupancyDetected( service ) {
                booleanCharacteristic( service, 'occupancyDetected', Characteristic.OccupancyDetected, null, config.topics.getOccupancyDetected, false, function( val ) {
                    return val ? Characteristic.OccupancyDetected.OCCUPANCY_DETECTED : Characteristic.OccupancyDetected.OCCUPANCY_NOT_DETECTED;
                } );
            }

            // Characteristic.CurrentAmbientLightLevel
            function characteristic_CurrentAmbientLightLevel( service ) {
                floatCharacteristic( service, 'currentAmbientLightLevel', Characteristic.CurrentAmbientLightLevel,
                    null, config.topics.getCurrentAmbientLightLevel, 0.0001 );
            }

            // Characteristic.CurrentTemperature
            function characteristic_CurrentTemperature( service ) {
                floatCharacteristic( service, 'currentTemperature', Characteristic.CurrentTemperature,
                    null, config.topics.getCurrentTemperature, 0 );

                // configured temperature ranges
                if( !tempRange( service, Characteristic.CurrentTemperature ) ) {
                    // or (old behaviour) allow negative temperatures (down to -100)
                    let characteristic = service.getCharacteristic( Characteristic.CurrentTemperature );
                    characteristic.props.minValue = -100;
                }
            }

            // History for CurrentTemperature (Eve-only)
            function history_CurrentTemperature( historySvc ) {
                if( config.topics.getCurrentTemperature ) {
                    // additional MQTT subscription instead of set-callback due to correct averaging:
                    mqttSubscribe( config.topics.getCurrentTemperature, 'currentTemperature', function( topic, message ) {
                        var logEntry = {
                            time: Math.floor( Date.now() / 1000 ),  // seconds (UTC)
                            temp: parseFloat( message )  // fakegato-history logProperty 'temp' for temperature sensor
                        };
                        historySvc.addEntry( logEntry );
                    } );
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
                    config.topics.setTargetTemperature, config.topics.getTargetTemperature, 10 );

                // custom min/max
                tempRange( service, Characteristic.TargetTemperature );
            }

            // Characteristic.CoolingThresholdTemperature
            function characteristic_CoolingThresholdTemperature( service ) {
                floatCharacteristic( service, 'coolingThresholdTemperature', Characteristic.CoolingThresholdTemperature,
                    config.topics.setCoolingThresholdTemperature, config.topics.getCoolingThresholdTemperature, 25 );

                tempRange( service, Characteristic.CoolingThresholdTemperature );
            }

            // Characteristic.RelativeHumidityDehumidifierThreshold
            function characteristic_RelativeHumidityDehumidifierThreshold( service ) {
                floatCharacteristic( service, 'relativeHumidityDehumidifierThreshold', Characteristic.RelativeHumidityDehumidifierThreshold, config.topics.setRelativeHumidityDehumidifierThreshold, config.topics.getRelativeHumidityDehumidifierThreshold, 0 );
            }

            // Characteristic.HeatingThresholdTemperature
            function characteristic_HeatingThresholdTemperature( service ) {
                floatCharacteristic( service, 'heatingThresholdTemperature', Characteristic.HeatingThresholdTemperature,
                    config.topics.setHeatingThresholdTemperature, config.topics.getHeatingThresholdTemperature, 20 );

                tempRange( service, Characteristic.HeatingThresholdTemperature );
            }

            // Characteristic.CurrentRelativeHumidity
            function characteristic_CurrentRelativeHumidity( service ) {
                floatCharacteristic( service, 'currentRelativeHumidity', Characteristic.CurrentRelativeHumidity,
                    null, config.topics.getCurrentRelativeHumidity, 0 );
            }

            // Characteristic.TargetRelativeHumidity
            function characteristic_TargetRelativeHumidity( service ) {
                floatCharacteristic( service, 'targetRelativeHumidity', Characteristic.TargetRelativeHumidity,
                    config.topics.setTargetRelativeHumidity, config.topics.getTargetRelativeHumidity, 0 );
            }

            // History for CurrentRelativeHumidity (Eve-only)
            function history_CurrentRelativeHumidity( historySvc ) {
                if( config.topics.getCurrentRelativeHumidity ) {
                    // additional MQTT subscription instead of set-callback due to correct averaging:
                    mqttSubscribe( config.topics.getCurrentRelativeHumidity, 'currentRelativeHumidity', function( topic, message ) {
                        var logEntry = {
                            time: Math.floor( Date.now() / 1000 ),  // seconds (UTC)
                            humidity: parseFloat( message )  // fakegato-history logProperty 'humidity' for humidity sensor
                        };
                        historySvc.addEntry( logEntry );
                    } );
                }
            }

            // Characteristic.characteristic_AirPressure (Eve-only)
            function characteristic_AirPressure( service ) {
                floatCharacteristic( service, 'airPressure', Eve.Characteristics.AirPressure, null, config.topics.getAirPressure, 700 );
                // set characteristic Elevation for air pressure calibration (not used yet with MQTT)
                service.updateCharacteristic( Eve.Characteristics.Elevation, 100 );
            }

            // History for AirPressure (Eve-only)
            function history_AirPressure( historySvc ) {
                if( config.topics.getAirPressure ) {
                    // additional MQTT subscription instead of set-callback due to correct averaging:
                    mqttSubscribe( config.topics.getAirPressure, 'airPressure', function( topic, message ) {
                        var logEntry = {
                            time: Math.floor( Date.now() / 1000 ),  // seconds (UTC)
                            pressure: parseFloat( message )  // fakegato-history logProperty 'pressure' for air pressure sensor
                        };
                        historySvc.addEntry( logEntry );
                    } );
                }
            }

            // Characteristic.WeatherCondition (Eve-only)
            function characteristic_WeatherCondition( service ) {
                service.addOptionalCharacteristic( Eve.Characteristics.Condition ); // to avoid warnings
                stringCharacteristic( service, 'weatherCondition', Eve.Characteristics.Condition, null, config.topics.getWeatherCondition, '-' );
            }

            // Characteristic.Rain1h (Eve-only)
            function characteristic_Rain1h( service ) {
                service.addOptionalCharacteristic( Eve.Characteristics.Rain1h ); // to avoid warnings
                integerCharacteristic( service, 'rain1h', Eve.Characteristics.Rain1h, null, config.topics.getRain1h );
            }

            // Characteristic.Rain24h (Eve-only)
            function characteristic_Rain24h( service ) {
                service.addOptionalCharacteristic( Eve.Characteristics.Rain24h ); // to avoid warnings
                integerCharacteristic( service, 'rain24h', Eve.Characteristics.Rain24h, null, config.topics.getRain24h );
            }

            // Characteristic.UVIndex (Eve-only)
            function characteristic_UVIndex( service ) {
                service.addOptionalCharacteristic( Eve.Characteristics.UvIndex ); // to avoid warnings
                integerCharacteristic( service, 'uvIndex', Eve.Characteristics.UvIndex, null, config.topics.getUVIndex );
            }

            // Characteristic.Visibility (Eve-only)
            function characteristic_Visibility( service ) {
                service.addOptionalCharacteristic( Eve.Characteristics.Visibility ); // to avoid warnings
                integerCharacteristic( service, 'visibility', Eve.Characteristics.Visibility, null, config.topics.getVisibility );
            }

            // Characteristic.WindDirection (Eve-only)
            function characteristic_WindDirection( service ) {
                service.addOptionalCharacteristic( Eve.Characteristics.WindDirection ); // to avoid warnings
                stringCharacteristic( service, 'windDirection', Eve.Characteristics.WindDirection, null, config.topics.getWindDirection, '-' );
            }

            // Characteristic.WindSpeed (Eve-only)
            function characteristic_WindSpeed( service ) {
                service.addOptionalCharacteristic( Eve.Characteristics.WindSpeed ); // to avoid warnings
                floatCharacteristic( service, 'windSpeed', Eve.Characteristics.WindSpeed, null, config.topics.getWindSpeed, 0 );
            }

            // Characteristic.maxWind (Eve-only)
            function characteristic_MaximumWindSpeed( service ) {
                service.addOptionalCharacteristic( Eve.Characteristics.MaximumWindSpeed ); // to avoid warnings
                floatCharacteristic( service, 'maxWind', Eve.Characteristics.MaximumWindSpeed, null, config.topics.getmaxWind, 0 );
            }

            // Characteristic.Dewpoint(Eve-only)
            function characteristic_DewPoint( service ) {
                service.addOptionalCharacteristic( Eve.Characteristics.DewPoint ); // to avoid warnings
                floatCharacteristic( service, 'DewPoint', Eve.Characteristics.DewPoint, null, config.topics.getDewPoint, 0 );
            }

            // Characteristic.ContactSensorState
            function characteristic_ContactSensorState( service ) {
                booleanCharacteristic( service, 'contactSensorState', Characteristic.ContactSensorState,
                    null, config.topics.getContactSensorState, false, function( val ) {
                        return val ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED;
                    }, undefined, config.resetStateAfterms );
            }

            // History for ContactSensorState (Eve-only)
            function history_ContactSensorState( historySvc, service ) {
                characteristic_LastActivation( historySvc, service );

                // get characteristic to be logged
                var charac = service.getCharacteristic( Characteristic.ContactSensorState );

                // counterFile for saving 'timesOpened' and 'resetTotal'
                const counterFile = historyCounterFile();

                function writeCounterFile() {
                    let saveObj = { timesOpened: state.timesOpened, resetTotal: state.resetTotal };
                    fs.writeFile( counterFile, JSON.stringify( saveObj ), 'utf8', function( err ) {
                        if( err ) {
                            log( 'Error: cannot write file to save timesOpened' );
                        }
                    } );
                }

                // load TimesOpened counter from counterFile
                fs.readFile( counterFile, 'utf8', function( err, data ) {
                    let cnt = 0;
                    let res = Math.floor( Date.now() / 1000 ) - 978307200;  // seconds since 01.01.2001
                    if( err ) {
                        log.debug( 'No data loaded for TimesOpened' );
                    } else {
                        cnt = JSON.parse( data ).timesOpened;
                        res = JSON.parse( data ).resetTotal;
                    }
                    service.addOptionalCharacteristic( Eve.Characteristics.TimesOpened ); // to avoid warnings
                    addCharacteristic( service, 'timesOpened', Eve.Characteristics.TimesOpened, cnt );
                    historySvc.addOptionalCharacteristic( Eve.Characteristics.ResetTotal ); // to avoid warnings
                    addCharacteristic( historySvc, 'resetTotal', Eve.Characteristics.ResetTotal, res, function() {
                        state.timesOpened = 0; // reset counter
                        service.updateCharacteristic( Eve.Characteristics.TimesOpened, 0 );
                        writeCounterFile();
                        log( "Reset TimesOpened to 0" );
                    } );

                    // these ones are necessary to display history for contact sensors
                    service.addOptionalCharacteristic( Eve.Characteristics.OpenDuration ); // to avoid warnings
                    addCharacteristic( service, 'openDuration', Eve.Characteristics.OpenDuration, 0 );
                    service.addOptionalCharacteristic( Eve.Characteristics.ClosedDuration ); // to avoid warnings
                    addCharacteristic( service, 'closedDuration', Eve.Characteristics.ClosedDuration, 0 );

                    // attach change callback for this characteristic
                    charac.on( 'change', function( obj ) {
                        var logEntry = {
                            time: Math.floor( Date.now() / 1000 ),  // seconds (UTC)
                            status: obj.newValue  // fakegato-history logProperty 'status' for contact sensor
                        };
                        // update Eve's Characteristic.LastActivation
                        state.lastActivation = logEntry.time - historySvc.getInitialTime();
                        service.updateCharacteristic( Eve.Characteristics.LastActivation, state.lastActivation );
                        if( logEntry.status ) {
                            // update Eve's Characteristic.TimesOpened
                            state.timesOpened++;
                            service.updateCharacteristic( Eve.Characteristics.TimesOpened, state.timesOpened );
                            writeCounterFile();
                        }
                        historySvc.addEntry( logEntry );
                    } );
                } );
            }

            // Characteristic.ProgrammableSwitchEvent
            function characteristic_ProgrammableSwitchEvent( service, property, getTopic, switchValues, restrictSwitchValues ) {
                let values = switchValues;
                if( !values ) {
                    values = [ '1', '2', 'L' ]; // 1 means SINGLE_PRESS, 2 means DOUBLE_PRESS, L means LONG_PRESS
                }
                multiCharacteristic( service, property, Characteristic.ProgrammableSwitchEvent, null, getTopic, values, null, true );
                if( restrictSwitchValues ) {
                    let characteristic = service.getCharacteristic( Characteristic.ProgrammableSwitchEvent );
                    characteristic.props.validValues = restrictSwitchValues;
                }
            }

            // Characteristic.Volume
            function characteristic_Volume( service ) {
                floatCharacteristic( service, 'volume', Characteristic.Volume, config.topics.setVolume, config.topics.getVolume, 0 );
            }

            // Characteristic.Mute
            function characteristic_Mute( service ) {
                booleanCharacteristic( service, 'mute', Characteristic.Mute, config.topics.setMute, config.topics.getMute, false );
            }

            // Characteristic.SecuritySystemCurrentState
            function characteristic_SecuritySystemCurrentState( service ) {
                let values = config.currentStateValues;
                if( !values ) {
                    values = [ 'SA', 'AA', 'NA', 'D', 'T' ];
                }
                multiCharacteristic( service, 'currentState', Characteristic.SecuritySystemCurrentState, null, config.topics.getCurrentState, values, Characteristic.SecuritySystemCurrentState.DISARMED );
            }

            // Characteristic.SecuritySystemTargetState
            function characteristic_SecuritySystemTargetState( service ) {
                let values = config.targetStateValues;
                if( !values ) {
                    values = [ 'SA', 'AA', 'NA', 'D' ];
                }
                multiCharacteristic( service, 'targetState', Characteristic.SecuritySystemTargetState, config.topics.setTargetState, config.topics.getTargetState, values, Characteristic.SecuritySystemTargetState.DISARM );
                if( config.restrictTargetState ) {
                    let characteristic = service.getCharacteristic( Characteristic.SecuritySystemTargetState );
                    characteristic.props.validValues = config.restrictTargetState;
                }
            }

            // Characteristic.SmokeDetected
            function characteristic_SmokeDetected( service ) {
                booleanCharacteristic( service, 'smokeDetected', Characteristic.SmokeDetected,
                    null, config.topics.getSmokeDetected, false, function( val ) {
                        return val ? Characteristic.SmokeDetected.SMOKE_DETECTED : Characteristic.SmokeDetected.SMOKE_NOT_DETECTED;
                    }, undefined, config.resetStateAfterms );
            }

            // Characteristic.CurrentDoorState
            function characteristic_CurrentDoorState( service ) {
                let values = config.doorCurrentValues || config.doorValues;
                if( !values ) {
                    values = [ 'O', 'C', 'o', 'c', 'S' ];
                }
                multiCharacteristic( service, 'currentDoorState', Characteristic.CurrentDoorState, null, config.topics.getCurrentDoorState, values, Characteristic.CurrentDoorState.CLOSED );
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
                        setCharacteristic( charac, mapValueFunc( state[ property ] ) );
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
                        } else if( !isRecvValueOff( message ) ) {
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
            function characteristic_TargetDoorState( service ) {
                let values = config.doorTargetValues || config.doorValues;
                if( !values ) {
                    values = [ 'O', 'C' ];
                }
                multiCharacteristic( service, 'targetDoorState', Characteristic.TargetDoorState, config.topics.setTargetDoorState, config.topics.getTargetDoorState, values, Characteristic.TargetDoorState.OPEN );
            }

            // Characteristic.ObstructionDetected
            function characteristic_ObstructionDetected( service ) {
                booleanCharacteristic( service, 'obstructionDetected', Characteristic.ObstructionDetected, null, config.topics.getObstructionDetected, false );
            }

            // Characteristic.LockCurrentState
            function characteristic_LockCurrentState( service ) {
                let values = config.lockValues;
                if( !values ) {
                    values = [ 'U', 'S', 'J', '?' ];
                }
                multiCharacteristic( service, 'lockCurrentState', Characteristic.LockCurrentState, null, config.topics.getLockCurrentState, values, Characteristic.LockCurrentState.UNSECURED );
            }

            // Characteristic.LockTargetState
            function characteristic_LockTargetState( service ) {
                let values = config.lockValues;
                if( !values ) {
                    values = [ 'U', 'S' ];
                }
                multiCharacteristic( service, 'lockTargetState', Characteristic.LockTargetState, config.topics.setLockTargetState, config.topics.getLockTargetState, values, Characteristic.LockTargetState.UNSECURED );
            }

            // Characteristic.RotationDirection
            function characteristic_RotationDirection( service ) {
                integerCharacteristic( service, 'rotationDirection', Characteristic.RotationDirection, config.topics.setRotationDirection, config.topics.getRotationDirection );
            }

            // Characteristic.RotationSpeed
            function characteristic_RotationSpeed( service, handleOn ) {

                if( config.topics.setOn || !handleOn ) {
                    // separate On topic, or we're not handling 'On', so implement standard rotationSpeed characteristic
                    integerCharacteristic( service, 'rotationSpeed', Characteristic.RotationSpeed, config.topics.setRotationSpeed, config.topics.getRotationSpeed,
                        { minValue: config.minRotationSpeed, maxValue: config.maxRotationSpeed } );
                } else {
                    // no separate On topic, so use RotationSpeed 0 to indicate Off state...

                    // subscription
                    if( config.topics.getRotationSpeed ) {
                        mqttSubscribe( config.topics.getRotationSpeed, 'rotationSpeed', ( topic, message ) => {
                            let newState = parseInt( message );
                            let newOn = ( newState != 0 );
                            if( state.rotationSpeed != newState || state.on != newOn ) {
                                if( newOn ) {
                                    state.rotationSpeed = newState;
                                    setCharacteristic( service.getCharacteristic( Characteristic.RotationSpeed ), newState );
                                }
                                state.on = newOn;
                                setCharacteristic( service.getCharacteristic( Characteristic.On ), newState != 0 );
                            }
                        } );
                    }

                    // publishing (throttled)
                    let publishNow = function() {
                        let rot = state.rotationSpeed;
                        if( !config.topics.setOn && !state.on ) {
                            rot = 0;
                        }
                        mqttPublish( config.topics.setRotationSpeed, 'rotationSpeed', rot );
                    };

                    let publish = () => throttledCall( publishNow, 'rotationSpeed_pub', 20 );

                    // RotationSpeed characteristic
                    addCharacteristic( service, 'rotationSpeed', Characteristic.RotationSpeed, 0, () => {
                        if( state.rotationSpeed > 0 && !state.on ) {
                            state.on = true;
                        }
                        publish();
                    } );

                    // On Characteristic
                    addCharacteristic( service, 'on', Characteristic.On, false, function() {
                        if( state.on && state.rotationSpeed == 0 ) {
                            state.rotationSpeed = 100;
                        }
                        publish();
                    } );
                }
            }

            // Characteristic.BatteryLevel
            function characteristic_BatteryLevel( service ) {
                integerCharacteristic( service, 'batteryLevel', Characteristic.BatteryLevel, null, config.topics.getBatteryLevel );
            }

            // Characteristic.ChargingState
            function characteristic_ChargingState( service ) {
                let values = config.chargingStateValues;
                if( !values ) {
                    values = [ 'NOT_CHARGING', 'CHARGING', 'NOT_CHARGEABLE' ];
                }
                multiCharacteristic( service, 'chargingState', Characteristic.ChargingState, null, config.topics.getChargingState, values, Characteristic.ChargingState.NOT_CHARGING );
            }

            // Characteristic.LeakDetected
            function characteristic_LeakDetected( service ) {
                booleanCharacteristic( service, 'leakDetected', Characteristic.LeakDetected, null, config.topics.getLeakDetected, false, function( val ) {
                    return val ? Characteristic.LeakDetected.LEAK_DETECTED : Characteristic.LeakDetected.LEAK_NOT_DETECTED;
                }, undefined, config.resetStateAfterms );
            }

            // Characteristic.WaterLevel
            function characteristic_WaterLevel( service ) {
                let options = { minValue: 0, maxValue: 100 };
                integerCharacteristic( service, 'waterLevel', Characteristic.WaterLevel, config.topics.setWaterLevel, config.topics.getWaterLevel, options );
            }

            // Characteristic.TargetPosition
            function characteristic_TargetPosition( service ) {
                integerCharacteristic( service, 'targetPosition', Characteristic.TargetPosition, config.topics.setTargetPosition, config.topics.getTargetPosition, {
                    initialValue: config.minPosition || 0,
                    minValue: config.minPosition,
                    maxValue: config.maxPosition
                } );
            }

            // Characteristic.CurrentPosition
            function characteristic_CurrentPosition( service ) {
                integerCharacteristic( service, 'currentPosition', Characteristic.CurrentPosition, null, config.topics.getCurrentPosition, {
                    initialValue: config.minPosition || 0,
                    minValue: config.minPosition,
                    maxValue: config.maxPosition
                } );
            }

            // Characteristic.PositionState
            function characteristic_PositionState( service ) {
                let values = config.positionStateValues;
                if( !values ) {
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
                if( !values ) {
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
                service.addOptionalCharacteristic( Eve.Characteristics.AirParticulateDensity ); // to avoid warnings
                floatCharacteristic( service, 'airQualityPPM', Eve.Characteristics.AirParticulateDensity, null, config.topics.getAirQualityPPM );
            }

            // Eve.Characteristics.EveTemperatureDisplayUnits (Eve Room 2 only)
            // Defined with airQualitySensor support for room2 by D4rk (used if config.history && config.room2) but gives warning so removing for now and calling original characteristic_TemperatureDisplayUnits instead...
            // > This plugin generated a warning from the characteristic 'Temperature Display Units': characteristic value expected valid finite number and received "NaN" (number). See https://git.io/JtMGR for more info.
            // TODO: confirm with D4rk
            /*
            function characteristic_EveTemperatureDisplayUnits( service ) {
                stringCharacteristic( service, 'eveTemperatureDisplayUnits', Characteristic.TemperatureDisplayUnits, null, null, 'Celsius' )
            }
            */

            // History for Air Quality (Eve-only)
            function history_AirQualityPPM( historySvc ) {
                if( config.topics.getAirQualityPPM ) {
                    // additional MQTT subscription instead of set-callback due to correct averaging:
                    mqttSubscribe( config.topics.getAirQualityPPM, 'airQualityPPM', function( topic, message ) {
                        var logEntry = {
                            time: Math.floor( Date.now() / 1000 ),  // seconds (UTC)
                            ppm: parseFloat( message )  // fakegato-history logProperty 'ppm' for air quality sensor
                        };
                        historySvc.addEntry( logEntry );
                    } );
                }
            }

            // History for Air Quality (Eve Room 2 only)
            function history_VOCDensity( historySvc ) {
                if( config.topics.getVOCDensity ) {
                    // additional MQTT subscription instead of set-callback due to correct averaging:
                    mqttSubscribe( config.topics.getVOCDensity, 'VOCDensity', function( topic, message ) {
                        var logEntry = {
                            time: Math.floor( Date.now() / 1000 ),  // seconds (UTC)
                            voc: parseFloat( message )  // fakegato-history logProperty 'voc' for air quality sensor
                        };
                        historySvc.addEntry( logEntry );
                    } );
                }
            }

            // Characteristic.CarbonDioxideDetected
            function characteristic_CarbonDioxideDetected( service ) {
                let values = config.carbonDioxideDetectedValues;
                if( !values ) {
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
                if( !values ) {
                    values = [ 'OFF', 'HEAT', 'COOL' ];
                }
                multiCharacteristic( service, 'currentHeatingCoolingState', Characteristic.CurrentHeatingCoolingState, null, config.topics.getCurrentHeatingCoolingState, values, Characteristic.CurrentHeatingCoolingState.OFF );
            }

            // Characteristic.TargetHeatingCoolingState
            function characteristic_TargetHeatingCoolingState( service ) {
                let values = config.heatingCoolingStateValues;
                if( !values ) {
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
                if( !values ) {
                    values = [ 'INACTIVE', 'IDLE', 'HEATING', 'COOLING' ];
                }
                multiCharacteristic( service, 'currentHeaterCoolerState', Characteristic.CurrentHeaterCoolerState, null, config.topics.getCurrentHeaterCoolerState, values, Characteristic.CurrentHeaterCoolerState.INACTIVE );
            }

            // Characteristic.TargetHeaterCoolerState
            function characteristic_TargetHeaterCoolerState( service ) {
                let values = config.targetHeaterCoolerValues;
                if( !values ) {
                    values = [ 'AUTO', 'HEAT', 'COOL' ];
                }
                multiCharacteristic( service, 'targetHeaterCoolerState', Characteristic.TargetHeaterCoolerState, config.topics.setTargetHeaterCoolerState, config.topics.getTargetHeaterCoolerState, values, Characteristic.TargetHeaterCoolerState.AUTO );
                if( config.restrictHeaterCoolerState ) {
                    let characteristic = service.getCharacteristic( Characteristic.TargetHeaterCoolerState );
                    characteristic.props.validValues = config.restrictHeaterCoolerState;
                }
            }

            // Characteristic.TargetHumidifierDehumidifierState
            function characteristic_TargetHumidifierDehumidifierState( service ) {
                let values = config.targetHumidifierDehumidifierState;
                if( !values ) {
                    values = [ 'HUMIDIFIER_OR_DEHUMIDIFIER', 'HUMIDIFIER', 'DEHUMIDIFIER' ];
                }
                multiCharacteristic( service, 'targetHumidifierDehumidifierState', Characteristic.TargetHumidifierDehumidifierState, config.topics.setTargetHumidifierDehumidifierState, config.topics.getTargetHumidifierDehumidifierState, values, Characteristic.TargetHumidifierDehumidifierState.DEHUMIDIFIER );
                if( config.restrictDehumidifierState ) {
                    let characteristic = service.getCharacteristic( Characteristic.TargetDehumidifierState );
                    characteristic.props.validValues = config.restrictDehumidifierState;
                }
            }

            // Characteristic.CurrentHumidifierDehumidifierState
            function characteristic_CurrentHumidifierDehumidifierState( service ) {
                let values = config.currentHumidifierDehumidifierState;
                if( !values ) {
                    values = [ 'INACTIVE', 'IDLE', 'HUMIDIFYING', 'DEHUMIDIFYING' ];
                }
                multiCharacteristic( service, 'currentHumidifierDehumidifierState', Characteristic.CurrentHumidifierDehumidifierState, null, config.topics.getCurrentHumidifierDehumidifierState, values, Characteristic.CurrentHumidifierDehumidifierState.INACTIVE );
            }

            // Characteristic.CurrentAirPurifierState
            function characteristic_CurrentAirPurifierState( service ) {
                let values = config.currentAirPurifierStateValues;
                if( !values ) {
                    values = [ 'INACTIVE', 'IDLE', 'PURIFYING' ];
                }
                multiCharacteristic( service, 'currentAirPurifierState', Characteristic.CurrentAirPurifierState, null, config.topics.getCurrentAirPurifierState, values, Characteristic.CurrentAirPurifierState.INACTIVE );
            }

            // Characteristic.TargetAirPurifierState
            function characteristic_TargetAirPurifierState( service ) {
                let values = config.targetAirPurifierStateValues;
                if( !values ) {
                    values = [ 'MANUAL', 'AUTO' ];
                }
                multiCharacteristic( service, 'targetAirPurifierState', Characteristic.TargetAirPurifierState, config.topics.setTargetAirPurifierState, config.topics.getTargetAirPurifierState, values, Characteristic.TargetAirPurifierState.AUTO );
            }

            // Characteristic.LockPhysicalControls
            function characteristic_LockPhysicalControls( service ) {
                let values = config.lockPhysicalControlsValues;
                if( !values ) {
                    values = [ 'DISABLED', 'ENABLED' ];
                }
                multiCharacteristic( service, 'lockPhysicalControls', Characteristic.LockPhysicalControls, config.topics.setLockPhysicalControls, config.topics.getLockPhysicalControls, values, Characteristic.LockPhysicalControls.CONTROL_LOCK_DISABLED );
            }

            // Characteristic.SwingMode
            function characteristic_SwingMode( service ) {
                let values = config.swingModeValues;
                if( !values ) {
                    values = [ 'DISABLED', 'ENABLED' ];
                }
                multiCharacteristic( service, 'swingMode', Characteristic.SwingMode, config.topics.setSwingMode, config.topics.getSwingMode, values, Characteristic.SwingMode.DISABLED );
            }

            // Characteristic.TemperatureDisplayUnits
            function characteristic_TemperatureDisplayUnits( service ) {
                let values = config.temperatureDisplayUnitsValues;
                if( !values ) {
                    values = [ 'CELSIUS', 'FAHRENHEIT' ];
                }
                multiCharacteristic( service, 'temperatureDisplayUnits', Characteristic.TemperatureDisplayUnits,
                    config.topics.setTemperatureDisplayUnits, config.topics.getTemperatureDisplayUnits, values,
                    Characteristic.TemperatureDisplayUnits.CELSIUS );
            }

            // Characteristic.ServiceLabelIndex
            function characteristic_ServiceLabelIndex( service, index ) {
                service.setCharacteristic( Characteristic.ServiceLabelIndex, index );
            }

            // Characteristic.ServiceLabelNamespace
            function characteristic_ServiceLabelNamespace( service ) {
                if( config.labelType === 'dots' ) {
                    service.setCharacteristic( Characteristic.ServiceLabelNamespace, Characteristic.ServiceLabelNamespace.DOTS );
                } else if( config.labelType === 'numerals' ) {
                    service.setCharacteristic( Characteristic.ServiceLabelNamespace, Characteristic.ServiceLabelNamespace.ARABIC_NUMERALS );
                } else {
                    service.setCharacteristic( Characteristic.ServiceLabelNamespace, Characteristic.ServiceLabelNamespace.DOTS );
                }
            }

            // Eve.Characteristics.CurrentConsumption [Watts] (Eve-only)
            function characteristic_CurrentConsumption( service ) {
                service.addOptionalCharacteristic( Eve.Characteristics.CurrentConsumption ); // to avoid warnings
                floatCharacteristic( service, 'currentConsumption', Eve.Characteristics.CurrentConsumption, null, config.topics.getWatts, 0 );
            }

            // Eve.Characteristics.Voltage [Volts] (Eve-only)
            function characteristic_Voltage( service ) {
                service.addOptionalCharacteristic( Eve.Characteristics.Voltage ); // to avoid warnings
                floatCharacteristic( service, 'voltage', Eve.Characteristics.Voltage, null, config.topics.getVolts, {
                    minValue: config.minVolts, maxValue: config.maxVolts
                } );
            }

            // Eve.Characteristics.ElectricCurrent [Amperes] (Eve-only)
            function characteristic_ElectricCurrent( service ) {
                service.addOptionalCharacteristic( Eve.Characteristics.ElectricCurrent ); // to avoid warnings
                floatCharacteristic( service, 'electricCurrent', Eve.Characteristics.ElectricCurrent, null, config.topics.getAmperes, 0 );
            }

            // Eve.Characteristics.TotalConsumption [kWh] (Eve-only) - optional if there is an external energy counter
            function characteristic_TotalConsumption( service ) {
                service.addOptionalCharacteristic( Eve.Characteristics.TotalConsumption ); // to avoid warnings
                floatCharacteristic( service, 'totalConsumption', Eve.Characteristics.TotalConsumption, null, config.topics.getTotalConsumption, 0 );
            }

            // History for PowerConsumption (Eve-only)
            function history_PowerConsumption( historySvc, service ) {
                // enable mqttthing energy counter, if there is no getTotalConsumption topic
                const energyCounter = config.topics.getTotalConsumption ? false : true;
                var lastLogEntry = { time: 0, power: 0 };  // for energyCounter
                // counterFile for saving 'totalConsumption' and 'resetTotal'
                const counterFile = historyCounterFile();

                function writeCounterFile() {
                    let saveObj = { totalConsumption: state.totalConsumption, resetTotal: state.resetTotal };
                    fs.writeFile( counterFile, JSON.stringify( saveObj ), 'utf8', function( err ) {
                        if( err ) {
                            log( 'Error: cannot write file to save totalConsumption' );
                        }
                    } );
                }

                if( energyCounter ) {
                    // load TotalConsumption counter from counterFile
                    fs.readFile( counterFile, 'utf8', function( err, data ) {
                        let cnt = 0;
                        let res = Math.floor( Date.now() / 1000 ) - 978307200;  // seconds since 01.01.2001
                        if( err ) {
                            log.debug( 'No data loaded for totalConsumption' );
                        } else {
                            cnt = JSON.parse( data ).totalConsumption;
                            res = JSON.parse( data ).resetTotal;
                        }
                        service.addOptionalCharacteristic( Eve.Characteristics.TotalConsumption ); // to avoid warnings
                        addCharacteristic( service, 'totalConsumption', Eve.Characteristics.TotalConsumption, cnt );
                        historySvc.addOptionalCharacteristic( Eve.Characteristics.ResetTotal ); // to avoid warnings
                        addCharacteristic( historySvc, 'resetTotal', Eve.Characteristics.ResetTotal, res, function() {
                            state.totalConsumption = 0; // reset counter
                            service.updateCharacteristic( Eve.Characteristics.TotalConsumption, 0 );
                            writeCounterFile();
                            log( "Reset TotalConsumption to 0" );
                        } );
                    } );
                }

                if( config.topics.getWatts ) {
                    // additional MQTT subscription instead of set-callback due to correct averaging:
                    mqttSubscribe( config.topics.getWatts, 'watts', function( topic, message ) {
                        var logEntry = {
                            time: Math.floor( Date.now() / 1000 ),  // seconds (UTC)
                            power: parseFloat( message )  // fakegato-history logProperty 'power' for energy meter
                        };
                        if( energyCounter ) {
                            // update Eve's Characteristic.TotalConsumption:
                            if( lastLogEntry.time ) {
                                // energy counter: power * timeDifference (Ws --> kWh)
                                state.totalConsumption += lastLogEntry.power * ( logEntry.time - lastLogEntry.time ) / 1000 / 3600;
                            }
                            lastLogEntry.time = logEntry.time;
                            lastLogEntry.power = logEntry.power;
                            service.updateCharacteristic( Eve.Characteristics.TotalConsumption, state.totalConsumption );
                            writeCounterFile();
                        }
                        historySvc.addEntry( logEntry );
                    } );
                }
            }

            // Characteristic.Active
            function characteristic_Active( service, subIdx, subConfig ) {
                let property_active = 'active';
                let topic_setActive = config.topics.setActive;
                let topic_getActive = config.topics.getActive;
                // for usage in linked sub-services:
                if( subIdx !== undefined && subIdx !== null && subConfig ) {
                    property_active = property_active + '-' + subIdx;
                    topic_setActive = subConfig.topics.setActive;
                    topic_getActive = subConfig.topics.getActive;
                    if( !state.activePropertyList ) {
                        state.activePropertyList = [ property_active ];
                    } else {
                        state.activePropertyList.push( property_active );
                    }
                }
                booleanCharacteristic( service, property_active, Characteristic.Active, topic_setActive, topic_getActive, false, function( val ) {
                    return val ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE;
                }, config.turnOffAfterms );
            }

            // Characteristic.InUse
            function characteristic_InUse( service, subIdx, subConfig ) {
                let property_inUse = 'inUse';
                let topic_getInUse = config.topics.getInUse;
                // for usage in linked sub-services:
                if( subIdx !== undefined && subIdx !== null && subConfig ) {
                    property_inUse = property_inUse + '-' + subIdx;
                    topic_getInUse = subConfig.topics.getInUse;
                    if( !state.inUsePropertyList ) {
                        state.inUsePropertyList = [ property_inUse ];
                    } else {
                        state.inUsePropertyList.push( property_inUse );
                    }
                }
                booleanCharacteristic( service, property_inUse, Characteristic.InUse, null, topic_getInUse, false, function( val ) {
                    return val ? Characteristic.InUse.IN_USE : Characteristic.InUse.NOT_IN_USE;
                } );
            }

            function linkIrrigationCharacteristics( service, valveSvc, subIdx ) {
                service.addLinkedService( valveSvc );
                let mainActive = service.getCharacteristic( Characteristic.Active );
                let mainInUse = service.getCharacteristic( Characteristic.InUse );
                let valveActive = valveSvc.getCharacteristic( Characteristic.Active );
                let valveInUse = valveSvc.getCharacteristic( Characteristic.InUse );

                // if valve is active, main service must also be active
                // if none of the valves is active, main service should be deactivated (except with config.noAutoInactive)
                valveActive.on( 'change', function( obj ) {
                    if( obj.newValue == Characteristic.Active.ACTIVE && !state.active ) {
                        state.active = true;
                        mainActive.setValue( Characteristic.Active.ACTIVE, undefined, 'valve activated' );
                    } else if( obj.newValue == Characteristic.Active.INACTIVE && !config.noAutoInactive ) {
                        let mainActiveValue = false;
                        for( let prop of state.activePropertyList ) {
                            if( state[ prop ] ) {
                                mainActiveValue = true;
                                break;
                            }
                        }
                        if( !mainActiveValue && state.active ) {
                            state.active = false;
                            mainActive.setValue( Characteristic.Active.INACTIVE, undefined, 'all valves inactive' );
                        }
                    }
                } );

                // if main service is set to inactive, valves should also be inactive
                mainActive.on( 'change', function( obj ) {
                    if( obj.newValue == Characteristic.Active.INACTIVE && state[ 'active-' + subIdx ] ) {
                        state[ 'active-' + subIdx ] = false;
                        valveActive.setValue( Characteristic.Active.INACTIVE, undefined, 'main off' );
                    }
                } );

                // if valve is inUse, main service must also be inUse
                // if none of the valves is inUse, main service should not be inUse anymore
                valveInUse.on( 'change', function( obj ) {
                    if( obj.newValue == Characteristic.InUse.IN_USE && !state.inUse ) {
                        state.inUse = true;
                        mainInUse.updateValue( Characteristic.InUse.IN_USE );
                    } else if( obj.newValue == Characteristic.InUse.NOT_IN_USE ) {
                        let mainInUseValue = false;
                        for( let prop of state.inUsePropertyList ) {
                            if( state[ prop ] ) {
                                mainInUseValue = true;
                                break;
                            }
                        }
                        if( !mainInUseValue && state.inUse ) {
                            state.inUse = false;
                            mainInUse.updateValue( Characteristic.InUse.NOT_IN_USE );
                        }
                    }
                } );
            }

            // Characteristic.SetDuration
            function characteristic_SetDuration( service, subIdx, subConfig ) {
                let property_setDuration = 'setDuration';
                let topic_setDuration = config.topics.setDuration;
                let topic_getDuration = config.topics.getDuration;
                // for usage in linked sub-services:
                if( subIdx !== undefined && subIdx !== null && subConfig ) {
                    property_setDuration = property_setDuration + '-' + subIdx;
                    if( subConfig.topics.setDuration ) {
                        topic_setDuration = subConfig.topics.setDuration;
                    }
                    if( subConfig.topics.getDuration ) {
                        topic_getDuration = subConfig.topics.getDuration;
                    }
                }

                let initialValue = 1200;
                if( config.minDuration !== undefined && initialValue < config.minDuration ) {
                    initialValue = config.minDuration;
                } else if( config.maxDuration !== undefined && initialValue > config.maxDuration ) {
                    initialValue = config.maxDuration;
                }

                if( !topic_setDuration ) {
                    /* no topic specified, but propery is still created internally */
                    addCharacteristic( service, property_setDuration, Characteristic.SetDuration, initialValue, function() {
                        log.debug( 'set "' + property_setDuration + '" to ' + state[ property_setDuration ] + 's.' );
                    } );
                } else {
                    integerCharacteristic( service, property_setDuration, Characteristic.SetDuration, topic_setDuration, topic_getDuration, { initialValue } );
                }
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

            // Characteristic.RemainingDuration
            function characteristic_RemainingDuration( service, subIdx, subConfig ) {
                let property_active = 'active';
                let property_inUse = 'inUse';
                let property_setDuration = 'setDuration';
                let property_durationEndTime = 'durationEndTime';
                let topic_getRemainingDuration = config.topics.getRemainingDuration;
                // for usage in linked sub-services:
                if( subIdx !== undefined && subIdx !== null && subConfig ) {
                    property_active = property_active + '-' + subIdx;
                    property_inUse = property_inUse + '-' + subIdx;
                    property_setDuration = property_setDuration + '-' + subIdx;
                    property_durationEndTime = property_durationEndTime + '-' + subIdx;
                    topic_getRemainingDuration = subConfig.topics.getRemainingDuration;
                }
                // Instead of saving the remaining duration, the time of the expected end is stored.
                // This makes it easier to respond to following GET queries from HomeKit.
                state[ property_durationEndTime ] = Math.floor( Date.now() / 1000 );

                function getRemainingDuration() {
                    let remainingDuration = state[ property_durationEndTime ] - Math.floor( Date.now() / 1000 );
                    return ( state[ property_inUse ] && remainingDuration > 0 ) ? remainingDuration : 0;
                }

                // set up characteristic
                let charac = service.addCharacteristic( Characteristic.RemainingDuration );
                charac.on( 'get', function( callback ) {
                    handleGetStateCallback( callback, getRemainingDuration() );
                } );
                let characActive = service.getCharacteristic( Characteristic.Active );
                let characInUse = service.getCharacteristic( Characteristic.InUse );

                // duration timer function
                let durationTimer = null;

                function timerFunc() {
                    durationTimer = null;
                    state[ property_active ] = false;
                    characActive.setValue( Characteristic.Active.INACTIVE, undefined, 'time expired' );
                    // this will also publish a MQTT message
                }

                // update durationEndTime once when 'Active' changes to ACTIVE
                if( service.testCharacteristic( Characteristic.SetDuration ) ) {
                    if( config.durationTimer ) {
                        // add durationTimer (turn off timer)
                        characInUse.on( 'change', function( obj ) {
                            if( obj.newValue == Characteristic.InUse.IN_USE ) {
                                state[ property_durationEndTime ] = Math.floor( Date.now() / 1000 ) + state[ property_setDuration ];
                                durationTimer = setTimeout( timerFunc, state[ property_setDuration ] * 1000 );
                            } else {
                                if( durationTimer ) {
                                    clearTimeout( durationTimer );
                                }
                            }
                            charac.updateValue( getRemainingDuration() );
                        } );
                    } else {
                        // device will handle the timer by itself
                        characInUse.on( 'change', function( obj ) {
                            if( obj.newValue == Characteristic.InUse.IN_USE ) {
                                state[ property_durationEndTime ] = Math.floor( Date.now() / 1000 ) + state[ property_setDuration ];
                            }
                            charac.updateValue( getRemainingDuration() );
                        } );
                    }
                } else if( config.turnOffAfterms ) {
                    // no SetDuration Characteristic configured, but turnOffAfterms
                    characActive.on( 'change', function( obj ) {
                        if( obj.newValue == Characteristic.Active.ACTIVE ) {
                            state[ property_durationEndTime ] = Math.floor( ( Date.now() + config.turnOffAfterms ) / 1000 );
                        }
                        charac.updateValue( getRemainingDuration() );
                    } );
                }

                // update durationEndTime once when 'SetDuration' changes (if 'SetDuration' exists)
                if( service.testCharacteristic( Characteristic.SetDuration ) ) {
                    service.getCharacteristic( Characteristic.SetDuration ).on( 'change', function( obj ) {
                        // extend or shorten duration
                        let maxEndTime = Math.floor( Date.now() / 1000 ) + obj.newValue;
                        let newEndTime = state[ property_durationEndTime ] + ( obj.newValue - obj.oldValue );
                        state[ property_durationEndTime ] = ( newEndTime < maxEndTime ) ? newEndTime : maxEndTime;
                        charac.updateValue( getRemainingDuration() );
                        if( durationTimer ) {
                            // update timer
                            clearTimeout( durationTimer );
                            durationTimer = setTimeout( timerFunc, getRemainingDuration() * 1000 );
                        }
                    } );
                }

                // subscribe to get topic, update remainingDuration
                if( topic_getRemainingDuration ) {
                    mqttSubscribe( topic_getRemainingDuration, 'remainingDuration', function( topic, message ) {
                        let remainingDuration = parseInt( message );
                        state[ property_durationEndTime ] = Math.floor( Date.now() / 1000 ) + remainingDuration;
                        charac.updateValue( remainingDuration );
                        if( durationTimer ) {
                            // update timer
                            clearTimeout( durationTimer );
                            durationTimer = setTimeout( timerFunc, remainingDuration * 1000 );
                        }
                    } );
                }
            }

            // Characteristic.ValveType
            function characteristic_ValveType( service, valveType ) {
                if( valveType === undefined || valveType === null ) {
                    // if not specified by argument, use specification from config file
                    if( config.valveType === 'sprinkler' ) {
                        valveType = Characteristic.ValveType.IRRIGATION;
                    } else if( config.valveType === 'shower' ) {
                        valveType = Characteristic.ValveType.SHOWER_HEAD;
                    } else if( config.valveType === 'faucet' ) {
                        valveType = Characteristic.ValveType.WATER_FAUCET;
                    } else {
                        valveType = Characteristic.ValveType.GENERIC_VALVE;
                    }
                }
                service.setCharacteristic( Characteristic.ValveType, valveType );
            }

            // Characteristic.ActiveIdentifier
            function characteristic_ActiveIdentifier( service, values ) {
                multiCharacteristic( service, 'activeIdentifier', Characteristic.ActiveIdentifier, config.topics.setActiveInput, config.topics.getActiveInput, values, 0 );
            }

            // Characteristic.RemoteKey
            function characteristic_RemoteKey( service ) {
                let values = config.remoteKeyValues;
                if( !values ) {
                    values = [ 'REWIND', 'FAST_FORWARD', 'NEXT_TRACK', 'PREVIOUS_TRACK', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'SELECT', 'BACK', 'EXIT', 'PLAY_PAUSE', '12', '13', '14', 'INFO' ];
                }
                multiCharacteristic( service, 'remoteKey', Characteristic.RemoteKey, config.topics.setRemoteKey, undefined, values, null, true );
            }

            // Characteristic.FilterChangeIndication
            function characteristic_FilterChangeIndication( service ) {
                booleanCharacteristic( service, 'filterChangeIndication', Characteristic.FilterChangeIndication, null, config.topics.getFilterChangeIndication, false, function( val ) {
                    return val ? Characteristic.FilterChangeIndication.CHANGE_FILTER : Characteristic.FilterChangeIndication.FILTER_OK;
                } );
            }

            // Characteristic.FilterLifeLevel
            function characteristic_FilterLifeLevel( service ) {
                floatCharacteristic( service, 'filterLifeLevel', Characteristic.FilterLifeLevel, null, config.topics.getFilterLifeLevel, 100 );
            }

            // Characteristic.ResetFilterIndication
            function characteristic_ResetFilterIndication( service ) {
                booleanCharacteristic( service, 'resetFilterIndication', Characteristic.ResetFilterIndication, config.topics.setResetFilterIndication, null, false );
            }

            // add optional sensor characteristics
            function addSensorOptionalCharacteristics( service ) {
                if( config.topics.getStatusActive ) {
                    characteristic_StatusActive( service );
                }
                if( config.topics.getStatusFault ) {
                    characteristic_StatusFault( service );
                }
                if( config.topics.getStatusTampered ) {
                    characteristic_StatusTampered( service );
                }
                if( config.topics.getStatusLowBattery ) {
                    characteristic_StatusLowBattery( service );
                }
            }

            // add battery characteristics
            function addBatteryCharacteristics( service ) {
                if( config.topics.getBatteryLevel ) {
                    characteristic_BatteryLevel( service );
                }
                if( config.topics.getChargingState ) {
                    characteristic_ChargingState( service );
                }
                if( config.topics.getStatusLowBattery ) {
                    characteristic_StatusLowBattery( service );
                }
            }

            let name = config.name;
            let subtype = config.subtype;
            let svcNames = config.serviceNames || {}; // custom names for multi-service accessories

            let service = null; // to return a single service
            let services = null; // if returning multiple services

            //  config.type may be 'type-subtype', e.g. 'lightbulb-OnOff'
            let configType = config.type.split( '-' )[ 0 ]; // ignore configuration subtype

            if( configType == "lightbulb" ) {
                service = new Service.Lightbulb( name, subtype );
                if( config.topics.setHSV ) {
                    characteristics_HSVLight( service );
                } else if( config.topics.setRGB || config.topics.setRGBW || config.topics.setRGBWW ) {
                    characteristics_RGBLight( service );
                } else if( config.topics.setWhite ) {
                    characteristics_WhiteLight( service );
                } else {
                    if( config.topics.setOn || !config.topics.setBrightness ) {
                        characteristic_On( service );
                    }
                    if( config.topics.setBrightness ) {
                        characteristic_Brightness( service );
                    }
                    if( config.topics.setHue ) {
                        characteristic_Hue( service );
                    }
                    if( config.topics.setSaturation ) {
                        characteristic_Saturation( service );
                    }
                    if( config.topics.setColorTemperature ) {
                        characteristic_ColorTemperature( service );
                    } else if( supportAdaptiveLighting() && config.topics.setHue && config.topics.setSaturation ) {
                        // no color temperature topic, but support color - so add temperature for adaptive lighting
                        characteristic_ColorTemperature_Internal( service );
                    }
                }
            } else if( configType == "switch" ) {
                service = new Service.Switch( name, subtype );
                characteristic_On( service );
                services = [ service ];
                if( config.history ) {
                    let historyOptions = new HistoryOptions();
                    let historySvc = new HistoryService( 'switch', { displayName: name, log: log }, historyOptions );
                    history_On( historySvc, service );
                    // return history service too
                    services.push( historySvc );
                }
            } else if( configType == "outlet" ) {
                service = new Service.Outlet( name, subtype );
                characteristic_On( service );
                if( config.topics.getInUse ) {
                    characteristic_OutletInUse( service );
                }
                if( config.topics.getWatts ) {
                    characteristic_CurrentConsumption( service );
                }
                if( config.topics.getVolts ) {
                    characteristic_Voltage( service );
                }
                if( config.topics.getAmperes ) {
                    characteristic_ElectricCurrent( service );
                }
                if( config.topics.getTotalConsumption ) {
                    characteristic_TotalConsumption( service );
                }
                services = [ service ];
                if( config.history ) {
                    let historyOptions = new HistoryOptions();
                    let historySvc = new HistoryService( 'energy', { displayName: name, log: log }, historyOptions );
                    history_PowerConsumption( historySvc, service );
                    // return history service too
                    services.push( historySvc );
                }
            } else if( configType == "motionSensor" ) {
                service = new Service.MotionSensor( name, subtype );
                characteristic_MotionDetected( service );
                services = [ service ];
                if( config.history ) {
                    let historyOptions = new HistoryOptions( true );
                    let historySvc = new HistoryService( 'motion', { displayName: name, log: log }, historyOptions );
                    history_MotionDetected( historySvc, service );
                    // return history service too
                    services.push( historySvc );
                }
                addSensorOptionalCharacteristics( service );
            } else if( configType == "occupancySensor" ) {
                service = new Service.OccupancySensor( name, subtype );
                characteristic_OccupancyDetected( service );
                addSensorOptionalCharacteristics( service );
            } else if( configType == "lightSensor" ) {
                service = new Service.LightSensor( name, subtype );
                characteristic_CurrentAmbientLightLevel( service );
                addSensorOptionalCharacteristics( service );
            } else if( configType == "temperatureSensor" ) {
                service = new Service.TemperatureSensor( name, subtype );
                characteristic_CurrentTemperature( service );
                addSensorOptionalCharacteristics( service );
                services = [ service ];
                if( config.history ) {
                    let historyOptions = new HistoryOptions();
                    let historySvc = new HistoryService( 'weather', { displayName: name, log: log }, historyOptions );
                    history_CurrentTemperature( historySvc );
                    // return history service too
                    services.push( historySvc );
                }
            } else if( configType == "humiditySensor" ) {
                service = new Service.HumiditySensor( name, subtype );
                characteristic_CurrentRelativeHumidity( service );
                addSensorOptionalCharacteristics( service );
                services = [ service ];
                if( config.history ) {
                    let historyOptions = new HistoryOptions();
                    let historySvc = new HistoryService( 'weather', { displayName: name, log: log }, historyOptions );
                    history_CurrentRelativeHumidity( historySvc );
                    // return history service too
                    services.push( historySvc );
                }
            } else if( configType == "airPressureSensor" ) {
                service = new Eve.Services.AirPressureSensor( name, subtype );
                characteristic_AirPressure( service );
                addSensorOptionalCharacteristics( service );
                services = [ service ];
                if( config.history ) {
                    let historyOptions = new HistoryOptions();
                    let historySvc = new HistoryService( 'weather', { displayName: name, log: log }, historyOptions );
                    history_AirPressure( historySvc );
                    // return history service too
                    services.push( historySvc );
                }
            } else if( configType == "weatherStation" ) {
                service = new Service.TemperatureSensor( svcNames.temperature || name + " Temperature", subtype );
                characteristic_CurrentTemperature( service );
                addSensorOptionalCharacteristics( service );
                services = [ service ];
                if( config.topics.getCurrentRelativeHumidity ) {
                    let humSvc = new Service.HumiditySensor( svcNames.humidity || name + " Humidity", subtype );
                    characteristic_CurrentRelativeHumidity( humSvc );
                    addSensorOptionalCharacteristics( humSvc );
                    services.push( humSvc );
                }
                if( config.topics.getAirPressure ) {
                    let presSvc = new Eve.Services.AirPressureSensor( svcNames.airPressure || name + " AirPressure", subtype );
                    characteristic_AirPressure( presSvc );
                    addSensorOptionalCharacteristics( presSvc );
                    services.push( presSvc );
                }
                if( config.topics.getCurrentAmbientLightLevel ) {
                    let lightSvc = new Service.LightSensor( svcNames.ambientLightLevel || name + " Light Level", subtype );
                    characteristic_CurrentAmbientLightLevel( lightSvc );
                    addSensorOptionalCharacteristics( lightSvc );
                    services.push( lightSvc );
                }
                // custom service UUID for optional Eve characteristics
                let weatherSvc = new Service( svcNames.weather || name + " Weather", "D92D5391-92AF-4824-AF4A-356F25F25EA1" );
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
                if( config.topics.getmaxWind ) {
                    characteristic_MaximumWindSpeed( weatherSvc );
                    addWeatherSvc = true;
                }
                if( config.topics.getDewPoint ) {
                    characteristic_DewPoint( weatherSvc );
                    addWeatherSvc = true;
                }
                if( addWeatherSvc ) {
                    services.push( weatherSvc );
                }
                if( config.history ) {
                    let historyOptions = new HistoryOptions();
                    let historySvc = new HistoryService( 'weather', { displayName: name, log: log }, historyOptions );
                    history_CurrentTemperature( historySvc );
                    history_CurrentRelativeHumidity( historySvc );
                    history_AirPressure( historySvc );
                    services.push( historySvc );
                }
            } else if( configType == "contactSensor" ) {
                service = new Service.ContactSensor( name, subtype );
                characteristic_ContactSensorState( service );
                addSensorOptionalCharacteristics( service );
                services = [ service ];
                if( config.history ) {
                    let historyOptions = new HistoryOptions( true );
                    let historySvc = new HistoryService( 'door', { displayName: name, log: log }, historyOptions );
                    history_ContactSensorState( historySvc, service );
                    // return history service too
                    services.push( historySvc );
                }
            } else if( configType == "doorbell" ) {
                service = new Service.Doorbell( name, subtype );
                characteristic_ProgrammableSwitchEvent( service, 'switch', config.topics.getSwitch, config.switchValues, config.restrictSwitchValues );
                if( config.topics.setBrightness || config.topics.getBrightness ) {
                    characteristic_Brightness( service );
                }
                if( config.topics.setVolume || config.topics.getVolume ) {
                    characteristic_Volume( service );
                }
                services = [ service ];
                if( config.topics.getMotionDetected ) {
                    // also create motion sensor
                    let motionsvc = new Service.MotionSensor( svcNames.motion || name + '-motion', subtype );
                    characteristic_MotionDetected( motionsvc );
                    // return motion sensor too
                    services.push( motionsvc );
                }
            } else if( configType == "dehumidifier" ) {
                service = new Service.HumidifierDehumidifier( name, subtype );
                characteristic_Active( service );
                characteristic_CurrentRelativeHumidity( service );
                characteristic_CurrentHumidifierDehumidifierState( service );
                characteristic_TargetHumidifierDehumidifierState( service );

                if( config.topics.setRelativeHumidityDehumidifierThreshold ) {
                    characteristic_RelativeHumidityDehumidifierThreshold( service );
                }

                if( config.topics.getWaterLevel ) {
                    characteristic_WaterLevel( service );
                }
            } else if( configType == "statelessProgrammableSwitch" ) {
                if( Array.isArray( config.topics.getSwitch ) ) {
                    service = new Service.ServiceLabel( name );
                    characteristic_ServiceLabelNamespace( service );
                    services = [ service ];
                    var i = 0;
                    for( i = 0; i < config.topics.getSwitch.length; i++ ) {
                        let buttonTopic = config.topics.getSwitch[ i ];
                        let switchValues = config.switchValues;
                        if( switchValues ) {
                            if( Array.isArray( config.switchValues[ 0 ] ) ) {
                                if( config.switchValues.length > i ) {
                                    switchValues = config.switchValues[ i ];
                                } else {
                                    // If array is not long enough, just use the first entry
                                    switchValues = config.switchValues[ 0 ];
                                }
                            }
                        }
                        let restrictSwitchValues = config.restrictSwitchValues;
                        if( restrictSwitchValues ) {
                            if( Array.isArray( config.restrictSwitchValues[ 0 ] ) ) {
                                if( config.restrictSwitchValues.length > i ) {
                                    restrictSwitchValues = config.restrictSwitchValues[ i ];
                                } else {
                                    // If array is not long enough, just use the first entry
                                    restrictSwitchValues = config.restrictSwitchValues[ 0 ];
                                }
                            }
                        }
                        let buttonSvc = new Service.StatelessProgrammableSwitch( name + "_" + i, i + 1 );
                        characteristic_ProgrammableSwitchEvent( buttonSvc, 'switch' + i, buttonTopic, switchValues, restrictSwitchValues );
                        characteristic_ServiceLabelIndex( buttonSvc, i + 1 );
                        services.push( buttonSvc );
                    }
                } else {
                    service = new Service.StatelessProgrammableSwitch( name, subtype );
                    characteristic_ProgrammableSwitchEvent( service, 'switch', config.topics.getSwitch, config.switchValues, config.restrictSwitchValues );
                }
            } else if( configType == "securitySystem" ) {
                service = new Service.SecuritySystem( name, subtype );
                characteristic_SecuritySystemTargetState( service );
                characteristic_SecuritySystemCurrentState( service );
                if( config.topics.getStatusFault ) {
                    characteristic_StatusFault( service );
                }
                if( config.topics.getStatusTampered ) {
                    characteristic_StatusTampered( service );
                }
                if( config.topics.getAltSensorState ) {
                    characteristic_AltSensorState( service );
                }
                // todo: SecuritySystemAlarmType
            } else if( configType == "smokeSensor" ) {
                service = new Service.SmokeSensor( name, subtype );
                characteristic_SmokeDetected( service );
                addSensorOptionalCharacteristics( service );
            } else if( configType == "garageDoorOpener" ) {
                service = new Service.GarageDoorOpener( name, subtype );
                characteristic_TargetDoorState( service );
                if( config.topics.getDoorMoving ) {
                    characteristic_DoorMoving( service );
                } else {
                    characteristic_CurrentDoorState( service );
                }
                characteristic_ObstructionDetected( service );
                if( config.topics.setLockTargetState ) {
                    characteristic_LockTargetState( service );
                }
                if( config.topics.getLockCurrentState ) {
                    characteristic_LockCurrentState( service );
                }
            } else if( configType == "lockMechanism" ) {
                service = new Service.LockMechanism( name, subtype );
                if( config.topics.setLockTargetState ) {
                    characteristic_LockTargetState( service );
                }
                if( config.topics.getLockCurrentState ) {
                    characteristic_LockCurrentState( service );
                }
            } else if( configType == "fan" ) {
                service = new Service.Fan( name, subtype );
                if( config.topics.setOn || !config.topics.setRotationSpeed ) {
                    characteristic_On( service );
                }
                if( config.topics.getRotationDirection || config.topics.setRotationDirection ) {
                    characteristic_RotationDirection( service );
                }
                if( config.topics.getRotationSpeed || config.topics.setRotationSpeed ) {
                    characteristic_RotationSpeed( service, true );
                }
            } else if( configType == "leakSensor" ) {
                service = new Service.LeakSensor( name, subtype );
                characteristic_LeakDetected( service );
                if( config.topics.setWaterLevel || config.topics.getWaterLevel ) {
                    characteristic_WaterLevel( service );
                }
                addSensorOptionalCharacteristics( service );
            } else if( configType == "microphone" ) {
                service = new Service.Microphone( name, subtype );
                characteristic_Mute( service );
                if( config.topics.setVolume || config.topics.getVolume ) {
                    characteristic_Volume( service );
                }
            } else if( configType == "speaker" ) {
                service = new Service.Speaker( name, subtype );
                characteristic_Mute( service );
                if( config.topics.setVolume || config.topics.getVolume ) {
                    characteristic_Volume( service );
                }
            } else if( configType == "windowCovering" ) {
                service = new Service.WindowCovering( name, subtype );
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
                service = new Service.Window( name, subtype );
                characteristic_CurrentPosition( service );
                characteristic_TargetPosition( service );
                characteristic_PositionState( service );
                if( config.topics.setHoldPosition ) {
                    characteristic_HoldPosition( service );
                }
                if( config.topics.getObstructionDetected ) {
                    characteristic_ObstructionDetected( service );
                }
            } else if( configType == "door" ) {
                service = new Service.Door( name, subtype );
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
                service = new Service.AirQualitySensor( svcNames.airQuality || name, subtype );
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
                services = [ service ];
                if( config.topics.getCurrentTemperature ) {
                    let tempSvc = new Service.TemperatureSensor( svcNames.temperature || name + "-Temperature", subtype );
                    characteristic_CurrentTemperature( tempSvc );
                    characteristic_TemperatureDisplayUnits( tempSvc );
                    addSensorOptionalCharacteristics( tempSvc );
                    services.push( tempSvc );
                }
                if( config.topics.getCurrentRelativeHumidity ) {
                    let humSvc = new Service.HumiditySensor( svcNames.humidity || name + "-Humidity", subtype );
                    characteristic_CurrentRelativeHumidity( humSvc );
                    addSensorOptionalCharacteristics( humSvc );
                    services.push( humSvc );
                }
                if( config.history && config.room2 ) {
                    let historyOptions = new HistoryOptions();
                    let historySvc = new HistoryService( 'room2', { displayName: name, log: log }, historyOptions );
                    history_VOCDensity( historySvc );
                    history_CurrentTemperature( historySvc );
                    history_CurrentRelativeHumidity( historySvc );
                    services.push( historySvc );
                } else if( config.history ) {
                    let historyOptions = new HistoryOptions();
                    let historySvc = new HistoryService( 'room', { displayName: name, log: log }, historyOptions );
                    if( config.topics.getAirQualityPPM ) {
                        characteristic_AirQualityPPM( service );
                    }
                    history_AirQualityPPM( historySvc );
                    history_CurrentTemperature( historySvc );
                    history_CurrentRelativeHumidity( historySvc );
                    services.push( historySvc );
                }
            } else if( configType == 'carbonDioxideSensor' ) {
                service = new Service.CarbonDioxideSensor( name, subtype );
                characteristic_CarbonDioxideDetected( service );
                addSensorOptionalCharacteristics( service );
                if( config.topics.getCarbonDioxideLevel ) {
                    characteristic_CarbonDioxideLevel( service );
                }
                if( config.topics.getCarbonDioxidePeakLevel ) {
                    characteristic_CarbonDioxidePeakLevel( service );
                }
            } else if( configType == 'valve' ) {
                service = new Service.Valve( name, subtype );
                characteristic_ValveType( service );
                characteristic_Active( service );
                characteristic_InUse( service );
                if( config.topics.setDuration || config.durationTimer ) {
                    characteristic_SetDuration( service );
                    characteristic_RemainingDuration( service );
                } else if( config.topics.getRemainingDuration || config.turnOffAfterms ) {
                    characteristic_RemainingDuration( service );
                }
                addSensorOptionalCharacteristics( service );
            } else if( configType == 'thermostat' ) {
                service = new Service.Thermostat( name, subtype );
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
                service = new Service.HeaterCooler( name, subtype );
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
                    characteristic_RotationSpeed( service );
                }
            } else if( configType == 'television' ) {
                service = new Service.Television( name, subtype );
                service.isPrimaryService = true;
                characteristic_Active( service );
                service.setCharacteristic( Characteristic.ActiveIdentifier, 0 );
                service.setCharacteristic( Characteristic.ConfiguredName, name );
                service.setCharacteristic( Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE );
                // service.setCharacteristic(Characteristic.Brightness, XXX);  // no impact?
                // service.setCharacteristic(Characteristic.ClosedCaptions, XXX);  // no impact?
                // service.setCharacteristic(Characteristic.CurrentMediaState, XXX);  // no impact?
                // service.setCharacteristic(Characteristic.TargetMediaState, XXX);  // no impact?
                // service.setCharacteristic(Characteristic.PictureMode, XXX);  // no impact?
                // service.addCharacteristic(Characteristic.PowerModeSelection);  // this would add a button in TV settings
                characteristic_RemoteKey( service );

                services = [ service ];

                if( config.inputs ) {
                    var inputValues = [ 'NONE' ];   // MQTT values for ActiveIdentifier
                    var displayOrderTlvArray = [];  // for specific order instead of default alphabetical ordering
                    config.inputs.forEach( function( input, index ) {
                        let inputId = index + 1;
                        let inputName = input.name || 'Input ' + inputId;
                        let inputSvc = new Service.InputSource( inputName, inputId );
                        inputSvc.isHiddenService = true;  // not sure if necessary
                        service.addLinkedService( inputSvc );  // inputSvc must be linked to main service
                        inputSvc.setCharacteristic( Characteristic.Identifier, inputId );
                        inputSvc.setCharacteristic( Characteristic.ConfiguredName, inputName );
                        inputSvc.setCharacteristic( Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED );  // necessary for input to appear
                        inputSvc.setCharacteristic( Characteristic.InputDeviceType, Characteristic.InputDeviceType.OTHER ); // no impact?
                        inputSvc.setCharacteristic( Characteristic.InputSourceType, Characteristic.InputSourceType.OTHER ); // no impact?
                        var visibilityStateProperty = 'input' + inputId + '-visible';
                        addCharacteristic( inputSvc, visibilityStateProperty, Characteristic.TargetVisibilityState, Characteristic.TargetVisibilityState.SHOWN, function() {
                            // change CurrentVisibilityState when TargetVisibilityState changes
                            inputSvc.setCharacteristic( Characteristic.CurrentVisibilityState, state[ visibilityStateProperty ] );
                        } );
                        inputValues.push( input.value || inputId );
                        displayOrderTlvArray.push( 1, 1, inputId );  // type = 1 ("Identifier"), length = 1 Byte, Identifier value
                        services.push( inputSvc );
                    } );
                    characteristic_ActiveIdentifier( service, inputValues );  // for selecting inputs
                    var displayOrderTlv = Buffer.from( displayOrderTlvArray ).toString( 'base64' );
                    service.setCharacteristic( Characteristic.DisplayOrder, displayOrderTlv );
                }
            } else if( config.type == 'irrigationSystem' ) {
                service = new Service.IrrigationSystem( name, subtype );
                service.isPrimaryService = true;
                if( !config.topics ) {
                    config.topics = {};
                }
                characteristic_Active( service );
                characteristic_InUse( service );
                service.setCharacteristic( Characteristic.ProgramMode, Characteristic.ProgramMode.NO_PROGRAM_SCHEDULED );
                if( config.topics.getStatusFault ) {
                    characteristic_StatusFault( service );
                }

                services = [ service ];

                if( config.zones ) {
                    let serviceLabel = new Service.ServiceLabel();
                    serviceLabel.setCharacteristic( Characteristic.ServiceLabelNamespace, Characteristic.ServiceLabelNamespace.ARABIC_NUMERALS );
                    services.push( serviceLabel );
                    config.zones.forEach( function( zone, index ) {
                        let zoneId = index + 1;
                        let zoneName = zone.name || ''; // default name doesn't seem to work
                        let valveSvc = new Service.Valve( zoneName, zoneId );
                        characteristic_ValveType( valveSvc, Characteristic.ValveType.IRRIGATION );
                        characteristic_ServiceLabelIndex( valveSvc, zoneId );
                        characteristic_Active( valveSvc, zoneId, zone );
                        characteristic_InUse( valveSvc, zoneId, zone );
                        characteristic_SetDuration( valveSvc, zoneId, zone );
                        characteristic_RemainingDuration( valveSvc, zoneId, zone );
                        valveSvc.setCharacteristic( Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED );
                        if( zone.topics.getStatusFault ) {
                            characteristic_StatusFault( valveSvc );
                        }
                        linkIrrigationCharacteristics( service, valveSvc, zoneId );  // valveSvc must be linked to main service
                        services.push( valveSvc );
                    } );
                }
            } else if( configType == "airPurifier" ) {
                service = new Service.AirPurifier( name, subtype );
                characteristic_Active( service );
                characteristic_CurrentAirPurifierState( service );
                characteristic_TargetAirPurifierState( service );
                if( config.topics.getRotationSpeed || config.topics.setRotationSpeed ) {
                    characteristic_RotationSpeed( service );
                }
                if( config.topics.getSwingMode || config.topics.setSwingMode ) {
                    characteristic_SwingMode( service );
                }
                if( config.topics.setLockPhysicalControls || config.topics.getLockPhysicalControls ) {
                    characteristic_LockPhysicalControls( service );
                }
                services = [ service ];
                if( config.topics.getFilterChangeIndication || config.topics.getFilterLifeLevel || config.topics.setResetFilterIndication ) {
                    let filterSvc = new Service.FilterMaintenance( svcNames.filter || name + "-Filter", subtype );
                    service.addLinkedService( filterSvc );
                    characteristic_FilterChangeIndication( filterSvc ); // required
                    if( config.topics.getFilterLifeLevel ) {
                        characteristic_FilterLifeLevel( filterSvc );
                    }
                    if( config.topics.setResetFilterIndication ) {
                        characteristic_ResetFilterIndication( filterSvc );
                    }
                    services.push( filterSvc );
                }
            } else if( configType == 'battery' ) {
                service = new Service.BatteryService( name );
                addBatteryCharacteristics( service );
            } else {
                log( "ERROR: Unrecognized type: " + configType );
            }

            if( service ) {
                if( config.topics.getName ) {
                    characteristic_Name( service );
                }

                if( config.topics.getOnline ) {
                    state_Online();
                }
            }

            // always use services array
            if( !services ) {
                if( service ) {
                    services = [ service ];
                } else {
                    log( 'Error: No service(s) created for ' + name );
                    return;
                }
            }

            // optional battery service
            if( configType !== 'battery' ) {
                if( config.topics.getBatteryLevel || config.topics.getChargingState ||
                    ( config.topics.getStatusLowBattery && !service.testCharacteristic( Characteristic.StatusLowBattery ) ) ) {
                    // also create battery service
                    let batsvc = new Service.BatteryService( name + '-battery' );
                    addBatteryCharacteristics( batsvc );
                    services.push( batsvc );
                }
            }

            return services;
        }

        let services = null;

        if( accessoryConfig.type === "custom" && accessoryConfig.services ) {
            // multi-service/custom configuration...
            services = [];
            for( let svcCfg of accessoryConfig.services ) {
                let config = { ...accessoryConfig, ...svcCfg };
                if( !config.hasOwnProperty( 'subtype' ) ) {
                    config.subtype = config.name;
                }
                services = [ ...services, ...configToServices( config ) ];
            }
        } else {
            // single accessory
            services = configToServices( accessoryConfig );
        }

        // accessory information service
        services.push( makeAccessoryInformationService() );

        // start-up publishing
        if( accessoryConfig.startPub ) {
            if( Array.isArray( accessoryConfig.startPub ) ) {
                // new format - [ { topic: x, message: y }, ... ]
                for( let entry of accessoryConfig.startPub ) {
                    if( entry.topic ) {
                        mqttPublish( entry.topic, 'startPub', entry.message || '' );
                    }
                }
            } else {
                // old format - object of topic->message
                for( let topic in accessoryConfig.startPub ) {
                    if( accessoryConfig.startPub.hasOwnProperty( topic ) ) {
                        let msg = accessoryConfig.startPub[ topic ];
                        mqttPublish( topic, 'startPub', msg );
                    }
                }
            }
        }

        return services;
    }

    // The service
    var theServices = null;
    try {
        theServices = createServices();
    } catch( ex ) {
        log.error( 'Exception while creating services: ' + ex );
        log( ex.stack );
    }

    // Our accessory instance
    var thing = {};

    // Return services
    thing.getServices = function() {
        return theServices || [];
    };

    // Return controllers
    thing.getControllers = function() {
        return controllers;
    };

    return thing;
}

// Homebridge Entry point
module.exports = function( homebridge ) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Eve = new homebridgeLib.EveHomeKitTypes( homebridge );
    HistoryService = fakegatoHistory( homebridge );
    homebridgePath = homebridge.user.storagePath();

    homebridge.registerAccessory( "homebridge-mqttthing", "mqttthing", makeThing );
};
