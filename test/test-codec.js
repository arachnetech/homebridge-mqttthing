/**
 * Test/Demo Homebridge-MQTTThing Codec (encoder/decoder)
 * Codecs allow custom logic to be applied to accessories in mqttthing, rather like apply() functions, 
 * but in the convenience of a stand-alone JavaScript file.
 */

 'use strict';

/**
 * Initialise codec for accessory
 * @param {object} params Initialisation parameters object
 * @param {function} params.log Logging function
 * @param {object} params.config Configuration
 * @param {function} params.publish Function to publish a message directly to MQTT
 * @param {function} params.notify Function to send MQTT-Thing a property notification
 * @return {object} Encode and/or decode functions
 */
function init( params ) {
    // extract parameters for convenience
    let { log, config, publish, notify } = params;

    setTimeout( () => {
        let msg = `Hello from test-codec.js. This is ${config.name}.`;
        log( msg );

        // publish a test message
        publish( 'hello/mqtt', msg );

        // update state
        notify( 'on', config.onValue || 1 );
        notify( 'brightness', 50 );
        notify( 'HSV', '0,100,100' );
    }, 3000 );

    /**
     * Encode message before sending.
     * The output function may be called to deliver an encoded value for the property later.
     * @param {string} message Message from mqttthing to be published to MQTT
     * @param {object} info Object giving contextual information
     * @param {string} info.topic MQTT topic to be published
     * @param {string} info.property Property associated with publishing operation
     * @param {function} output Function which may be called to deliver the encoded value asynchronously
     * @returns {string} Processed message (optionally)
     */
    function encode( message, info, output ) {
        log( `encode() called for topic [${info.topic}], property [${info.property}] with message [${message}]` );

        // in this example we just delay publishing
        setTimeout( () => { 
            output( message );
        }, 1000 );
    }

    /**
     * Decode received message, and optionally return decoded value.
     * The output function may be called to deliver a decoded value for the property later.
     * @param {string} message Message received from MQTT
     * @param {object} info Object giving contextual information
     * @param {string} info.topic MQTT topic received
     * @param {string} info.property Property associated with subscription
     * @param {function} output Function which may be called to deliver the decoded value asynchronously
     * @returns {string} Processed message (optionally)
     */
    function decode( message, info, output ) { // eslint-disable-line no-unused-vars
        log( `decode() called for topic [${info.topic}], property [${info.property}] with message [${message}]` );

        // in this example we just delay passing the received mesage on to homebridge
        setTimeout( () => {
            output( message );
        }, 500 );
    }

    function encode_brightness( message ) {
        // scale up to 0-255 range
        log( "brightness out: " + message );
        return Math.floor( message * 2.55 );
    }

    function decode_brightness( message ) {
        // scale down to 0-100 range
        log( "brightness in: " + message );
        return Math.floor( message / 2.55 );
    }

    /**
     * The init() function must return an object containing encode and/or decode functions as defined above.
     * To define property-specific encode/decode functions, the following syntax may be used:
     *  {
     *      properties: {
     *          targetProp1: {
     *              encode: encodeFunction1,
     *              decode: decodeFunction2
     *          },
     *          targetProp2: {
     *              encode: encodeFunction2
     *          },
     *      },
     *      encode: defaultEncodeFunction,
     *      decode: defaultDecodeFunction
     *  }
     * 
     * The default encode/decode functions are called for properties for which no property-specific
     * entry is specified.
     */
    
    // return encode and decode functions
    return { 
        encode, decode, // default encode/decode functions
        properties: {
            brightness: { // encode/decode functions for brightness property
                encode: encode_brightness,
                decode: decode_brightness
            }
        }
    };
}

// export initialisation function
module.exports = {
    init
};
