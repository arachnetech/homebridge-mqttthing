// MQTT Thing Accessory plugin for Homebridge
// MQTT Library

'use strict'; // eslint-disable-line

var mqtt = require("mqtt");

var mqttlib = new function() {

    //! Initialise MQTT. Requires context ( { log, config } ).
    //! Context populated with mqttClient and mqttDispatch.
    this.init = function( ctx ) {
        // MQTT message dispatch
        let mqttDispatch = ctx.mqttDispatch = {}; // map of topic to function( topic, message ) to handle
        
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
                payload: 'Connection Closed abnormally..!',
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

        if( logmqtt ) {
            log( 'MQTT options: ' + JSON.stringify( options, function( k, v ) {
                if( k == "password" ) {
                    return undefined; // filter out
                }
                return v;
            } ) );
        }

        // add protocol to url string, if not yet available
        let brokerUrl = config.url;
        if( brokerUrl && ! brokerUrl.includes( '://' ) ) {
            brokerUrl = 'mqtt://' + brokerUrl;
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
            var handlers = mqttDispatch[topic];
            if (handlers) {
                for( var i = 0; i < handlers.length; i++ ) {
                    handlers[ i ]( topic, message );
                }
            } else {
                log('Warning: No MQTT dispatch handler for topic [' + topic + ']');
            }
        });

        ctx.mqttClient = mqttClient;
        return mqttClient;
    };

    // Subscribe
    this.subscribe = function( ctx, topic, handler ) {
        let { mqttDispatch, log, mqttClient } = ctx;
        if( ! mqttClient ) {
            log( 'ERROR: Call mqttlib.init() before mqttlib.subscribe()' );
            return;
        }

        if (typeof topic != 'string') {
            var extendedTopic = topic;
            topic = extendedTopic.topic;
            if (extendedTopic.hasOwnProperty('apply')) {
                var previous = handler;
                var applyFn = Function("message", extendedTopic['apply']); //eslint-disable-line
                handler = function (intopic, message) {
                    let decoded;
                    try {
                        decoded = applyFn( message );
                    } catch( ex ) {
                        log( 'Decode function apply( message) { ' + extendedTopic.apply + ' } failed for topic ' + topic + ' with message ' + message + ' - ' + ex );
                    }
                    if( decoded !== undefined ) {
                        return previous( intopic, decoded );
                    }
                };
            }
        }
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
    this.publish = function( ctx, topic, message ) {
        let { config, log, mqttClient } = ctx;
        if( ! mqttClient ) {
            log( 'ERROR: Call mqttlib.init() before mqttlib.publish()' );
            return;
        }

        if( message === null || topic === undefined ) {
            return; // don't publish if message is null or topic is undefined
        }

        if (typeof topic != 'string') {
            // encode data with user-supplied apply() function
            var extendedTopic = topic;
            topic = extendedTopic.topic;
            if (extendedTopic.hasOwnProperty('apply')) {
                var applyFn = Function("message", extendedTopic['apply']); //eslint-disable-line
                try {
                    message = applyFn(message);
                } catch( ex ) {
                    log( 'Encode function apply( message ) { ' + extendedTopic.apply + ' } failed for topic ' + topic + ' with message ' + message + ' - ' + ex );
                    message = null; // stop publish
                }
                if( message === null ) {
                    return;
                }
            }
        }

        // publish
        if( config.logMqtt ) {
            log( 'Publishing MQTT: ' + topic + ' = ' + message );
        }
        mqttClient.publish(topic, message.toString(), config.mqttPubOptions );
    };

    // Confirmed publisher
    this.makeConfirmedPublisher = function( ctx, setTopic, getTopic, makeConfirmed ) {

        let { state, config, log } = ctx;

        // if confirmation isn't being used, just return a simple publishing function
        if( ! config.confirmationPeriodms || ! getTopic || ! makeConfirmed ) {
            // no confirmation - return generic publishing function
            return function( message ) {
                mqttlib.publish( ctx, setTopic, message );
            }
        }

        var timer = null;
        var expected = null;
        var indicatedOffline = false;
        var retriesRemaining = 0;

        // subscribe to our get topic
        mqttlib.subscribe( ctx, getTopic, function( topic, message ) {
            if( message == expected && timer ) {
                clearTimeout( timer );
                timer = null;
                if( indicatedOffline ) {
                    state.online = true;
                    indicatedOffline = false;
                }
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
                // indicate offline (unless accessory is publishing this explicitly)
                if( ! config.topics.getOnline && ! indicatedOffline ) {
                    state.online = false;
                    indicatedOffline = true;
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
                mqttlib.publish( ctx, setTopic, message );
            }

            // initialise retry counter
            retriesRemaining = ( config.retryLimit === undefined ) ? 3 : config.retryLimit;

            // initial publish
            publish();
        };
    };

};

module.exports = mqttlib;
