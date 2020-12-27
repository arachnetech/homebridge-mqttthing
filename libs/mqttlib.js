// MQTT Thing Accessory plugin for Homebridge
// MQTT Library

'use strict'; // eslint-disable-line

const mqtt = require( "mqtt" );
const path = require( "path" );
const fs = require("fs");

var mqttlib = new function() {

    function makeCodecPath( codec, homebridgePath ) {
        let codecPath = codec;
        // if it doesn't start with a '/' (i.e. not fully-qualified)...
        if( codecPath[ 0 ] != '/' ) {
            if( codecPath.substr( codecPath.length - 3 ) !== '.js' ) {
                // no js extension - assume it's an internal codec
                codecPath = path.join( __dirname, '../codecs/', codecPath + '.js' );
            } else {
                // relative external codec is relative to homebridge userdata
                codecPath = path.join( homebridgePath, codecPath );
            }
        }
        return codecPath;
    }

    //! Initialise MQTT. Requires context ( { log, config } ).
    //! Context populated with mqttClient and mqttDispatch.
    this.init = function( ctx ) {
        // MQTT message dispatch
        let mqttDispatch = ctx.mqttDispatch = {}; // map of topic to [ function( topic, message ) ] to handle
        let propDispatch = ctx.propDispatch = {}; // map of proerty to [ rawhandler( topic, message ) ]

        let { config, log } = ctx;
        let logmqtt = config.logMqtt;
        var clientId = 'mqttthing_' + config.name.replace(/[^\x20-\x7F]/g, "") + '_' + Math.random().toString(16).substr(2, 8);

        // start with any configured options object
        var options = config.mqttOptions || {};

        // standard options set by mqtt-thing
        var myOptions = {
            keepalive: 10,
            clientId: clientId,
            protocolId: 'MQTT',
            protocolVersion: 4,
            clean: true,
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000,
            will: {
                topic: 'WillMsg',
                payload: 'mqtt-thing [' + ctx.config.name + '] has stopped',
                qos: 0,
                retain: false
            },
            username: config.username,
            password: config.password,
            rejectUnauthorized: false
        };

        // copy standard options into options unless already set by user
        for( var opt in myOptions ) {
            if( myOptions.hasOwnProperty( opt ) && ! options.hasOwnProperty( opt ) ) {
                options[ opt ] = myOptions[ opt ];
            }
        }

        // load ca/cert/key files
        if( options.cafile ) {
            options.ca = fs.readFileSync( options.cafile );
        }
        if( options.certfile ) {
            options.cert = fs.readFileSync( options.certfile );
        }
        if( options.keyfile ) {
            options.key = fs.readFileSync( options.keyfile );
        }

        // insecure
        if( options.insecure ) {
            options.checkServerIdentity = function( /* servername, cert */ ) { 
                return undefined; /* servername and certificate are verified */ 
            };
        }

        // add protocol to url string, if not yet available
        let brokerUrl = config.url;
        if( brokerUrl && ! brokerUrl.includes( '://' ) ) {
            brokerUrl = 'mqtt://' + brokerUrl;
        }

        // log MQTT settings
        if( logmqtt ) {
            log( 'MQTT URL: ' + brokerUrl );
            log( 'MQTT options: ' + JSON.stringify( options, function( k, v ) {
                if( k == "password" ) {
                    return undefined; // filter out
                }
                return v;
            } ) );
        }

        // create MQTT client
        var mqttClient = mqtt.connect(brokerUrl, options);
        mqttClient.on('error', function (err) {
            log('MQTT Error: ' + err);
        });

        mqttClient.on('message', function (topic, message) {
            if (logmqtt) {
                log("Received MQTT: " + topic + " = " + message);
            }
            let handlers = mqttDispatch[topic];
            if (handlers) {
                for( let i = 0; i < handlers.length; i++ ) {
                    handlers[ i ]( topic, message );
                }
            } else {
                log('Warning: No MQTT dispatch handler for topic [' + topic + ']');
            }
        });

        // Load any codec
        if( config.codec ) {
            let codecPath = makeCodecPath( config.codec, ctx.homebridgePath );
            if( fs.existsSync( codecPath ) ) {
                // load codec
                log( 'Loading codec from ' + codecPath );
                let codecMod = require( codecPath );
                if( typeof codecMod.init === "function" ) {

                    // direct publishing
                    let directPub = function( topic, message ) {
                        if( config.logMqtt ) {
                            log( 'Publishing MQTT: ' + topic + ' = ' + message );
                        }
                        mqttClient.publish( topic, message.toString(), config.mqttPubOptions );
                    };

                    // notification by property
                    let notifyByProp = function( property, message ) {
                        let handlers = propDispatch[ property ];
                        if( handlers ) {
                            for( let i = 0; i < handlers.length; i++ ) {
                                handlers[ i ]( '_prop-' + property, message );
                            }
                        }
                    };
                    
                    // initialise codec
                    let codec = ctx.codec = codecMod.init( { log, config, publish: directPub, notify: notifyByProp } );
                    if( codec ) {
                        // encode/decode must be functions
                        if( typeof codec.encode !== "function" ) {
                            log.warn( 'No codec encode() function' );
                            codec.encode = null;
                        }
                        if( typeof codec.decode !== "function" ) {
                            log.warn( 'No codec decode() function' );
                            codec.decode = null;
                        }
                    }
                } else {
                    // no initialisation function
                    log.error( 'ERROR: No codec initialisation function returned from ' + codecPath );
                }
            } else {
                log.error( 'ERROR: Codec file [' + codecPath + '] does not exist' );
            }
        }

        ctx.mqttClient = mqttClient;
        return mqttClient;
    };

    function getApplyState( ctx, property ) {
        if( ! ctx.hasOwnProperty( 'applyState' ) ) {
            ctx.applyState = { props: {}, global: {} };
        }
        if( ! ctx.applyState.props.hasOwnProperty( property ) ) {
            ctx.applyState.props[ property ] = { global: ctx.applyState.global };
        }
        return ctx.applyState.props[ property ];
    }

    function getCodecFunction( codec, property, functionName ) {
        if( codec ) {
            let fn;
            if( codec.properties && codec.properties[ property ] ) {
                fn = codec.properties[ property ][ functionName ];
            }
            if( fn === undefined ) {
                fn = codec[ functionName ];
            }
            return fn;
        }
    }

    // Subscribe
    this.subscribe = function( ctx, topic, property, handler ) {
        let rawHandler = handler;
        let { mqttDispatch, log, mqttClient, codec, propDispatch, config } = ctx;
        if( ! mqttClient ) {
            log( 'ERROR: Call mqttlib.init() before mqttlib.subscribe()' );
            return;
        }

        // debounce
        if( config.debounceRecvms ) {
            let origHandler = handler;
            let debounceTimeout = null;
            handler = function( intopic, message ) {
                if( debounceTimeout ) {
                    clearTimeout( debounceTimeout );
                }
                debounceTimeout = setTimeout( function() {
                    origHandler( intopic, message );
                }, config.debounceRecvms );
            }
        }

        // send through any apply function
        if (typeof topic != 'string') {
            let extendedTopic = topic;
            topic = extendedTopic.topic;
            if (extendedTopic.hasOwnProperty('apply')) {
                let previous = handler;
                let applyFn = Function( "message", "state", extendedTopic['apply'] ); //eslint-disable-line
                handler = function (intopic, message) {
                    let decoded;
                    try {
                        decoded = applyFn( message, getApplyState( ctx, property ) );
                    } catch( ex ) {
                        log( 'Decode function apply( message) { ' + extendedTopic.apply + ' } failed for topic ' + topic + ' with message ' + message + ' - ' + ex );
                    }
                    if( decoded !== undefined ) {
                        return previous( intopic, decoded );
                    }
                };
            }
        }

        // send through codec's decode function
        let codecDecode = getCodecFunction( codec, property, 'decode' );
        if( codecDecode ) {
            let realHandler = handler;
            let output = function( message ) {
                return realHandler( topic, message );
            };
            handler = function( intopic, message ) {
                let decoded = codecDecode( message, { topic, property }, output );
                if( decoded !== undefined ) {
                    return output( decoded );
                }
            };
        }

        // register property dispatch (codec only)
        if( codec ) {
            if( propDispatch.hasOwnProperty( property ) ) {
                // new handler for existing property
                propDispatch[ property ].push( rawHandler );
            } else {
                // new property
                propDispatch[ property ] = [ rawHandler ];
                if( ctx.config.logMqtt ) {
                    log( 'Avalable codec notification property: ' + property );
                }
            }
        }

        // register MQTT dispatch and subscribe
        if( mqttDispatch.hasOwnProperty( topic ) ) {
            // new handler for existing topic
            mqttDispatch[ topic ].push( handler );
        } else {
            // new topic
            mqttDispatch[ topic ] = [ handler ];
            mqttClient.subscribe(topic);
        }
    };

    // Publish
    this.publish = function( ctx, topic, property, message ) {
        let { config, log, mqttClient, codec } = ctx;
        if( ! mqttClient ) {
            log( 'ERROR: Call mqttlib.init() before mqttlib.publish()' );
            return;
        }

        if( message === null || topic === undefined ) {
            return; // don't publish if message is null or topic is undefined
        }

        // first of all, pass message through any user-supplied apply() function
        if (typeof topic != 'string') {
            // encode data with user-supplied apply() function
            var extendedTopic = topic;
            topic = extendedTopic.topic;
            if (extendedTopic.hasOwnProperty('apply')) {
                var applyFn = Function( "message", "state", extendedTopic['apply'] ); //eslint-disable-line
                try {
                    message = applyFn( message, getApplyState( ctx, property ) );
                } catch( ex ) {
                    log( 'Encode function apply( message ) { ' + extendedTopic.apply + ' } failed for topic ' + topic + ' with message ' + message + ' - ' + ex );
                    message = null; // stop publish
                }
                if( message === null || message === undefined ) {
                    return;
                }
            }
        }

        function publishImpl( finalMessage ) {
            if( config.logMqtt ) {
                log( 'Publishing MQTT: ' + topic + ' = ' + finalMessage );
            }
            mqttClient.publish( topic, finalMessage.toString(), config.mqttPubOptions );
        }

        // publish directly or through codec
        let codecEncode = getCodecFunction( codec, property, 'encode' );
        if( codecEncode ) {
            // send through codec's encode function
            let encoded = codecEncode( message, { topic, property }, publishImpl );
            if( encoded !== undefined ) {
                publishImpl( encoded );
            }
        } else {
            // publish as-is
            publishImpl( message );
        }
    };

    // Confirmed publisher
    this.makeConfirmedPublisher = function( ctx, setTopic, getTopic, property, makeConfirmed ) {

        let { state, config, log } = ctx;

        // if confirmation isn't being used, just return a simple publishing function
        if( ! config.confirmationPeriodms || ! getTopic || ! makeConfirmed ) {
            // no confirmation - return generic publishing function
            return function( message ) {
                mqttlib.publish( ctx, setTopic, property, message );
            }
        }

        var timer = null;
        var expected = null;
        var indicatedOffline = false;
        var retriesRemaining = 0;

        // subscribe to our get topic
        mqttlib.subscribe( ctx, getTopic, property, function( topic, message ) {
            if( ( message === expected || message == ( expected + '' ) ) && timer ) {
                clearTimeout( timer );
                timer = null;
            }
            if( indicatedOffline && ! timer ) {
                // if we're not waiting (or no-longer waiting), a message clears the offline state
                state.online = true;
                indicatedOffline = false;
                log( 'Setting accessory state to online' );
            }
        } );

        // return enhanced publishing function
        return function( message ) {
            // clear any existing confirmation timer
            if( timer ) {
                clearTimeout( timer );
                timer = null;
            }

            // confirmation timeout function
            function confirmationTimeout() {
                // confirmation period has expired
                timer = null;
                // indicate offline (unless accessory is publishing this explicitly - overridden with confirmationIndicateOffline)
                if( config.confirmationIndicateOffline !== false && ( ! config.topics.getOnline || config.confirmationIndicateOffline === true ) && ! indicatedOffline ) {
                    state.online = false;
                    indicatedOffline = true;
                    log( 'Setting accessory state to offline' );
                }

                // retry
                if( retriesRemaining > 0 ) {
                    --retriesRemaining;
                    publish();
                } else {
                    log( 'Unresponsive - no confirmation message received on ' + getTopic + ". Expecting [" + expected + "]." );
                }
            }

            function publish() {
                // set confirmation timer
                timer = setTimeout( confirmationTimeout, config.confirmationPeriodms );

                // publish
                expected = message;
                mqttlib.publish( ctx, setTopic, property, message );
            }

            // initialise retry counter
            retriesRemaining = ( config.retryLimit === undefined ) ? 3 : config.retryLimit;

            // initial publish
            publish();
        };
    };

};

module.exports = mqttlib;
