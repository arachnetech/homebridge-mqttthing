/**
 * Test/Demo Homebridge-MQTTThing Codec (encoder/decoder)
 * Codecs allow custom logic to be applied to accessories in mqttthing, rather like apply() functions, 
 * but in the convenience of a stand-alone JavaScript file.
 */

 'use strict';

var log, config;

function init( params ) {
    // grab the parameters that we want
    ( { log, config } = params );

    setInterval( () => {
        log( `Hello from test-codec.js. This is ${config.name}.` );
    }, 2000 );
}

function encode() {
}

function decode( message, info ) {
    log( `decode() called for topic ${info.topic}, property ${info.property}` );
    return message;
}

/**
 * Exported functions - one or more of:
 * init( params ) - called on start-up with params object holding: logging (log) and configuration (config)
 * encode( )
 * decode( message, info ) - info is object with topic and property
 */
// Export our functions
module.exports = {
    init,
    encode,
    decode
};
