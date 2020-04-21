/**
 * Test/Demo Homebridge-MQTTThing Codec (encoder/decoder)
 * Codecs allow custom logic to be applied to accessories in mqttthing, rather like apply() functions, 
 * but in the convenience of a stand-alone JavaScript file.
 * 
 * empty-codec.js - shows the structure of a codec, but does nothing
 */

'use strict';

// todo: declare any global state

/**
 * Initialise codec for accessory
 * @param {object} params Initialisation parameters object
 * @param {function} params.log Logging function
 * @param {object} params.config Configuration
 * @return {object} Encode and/or decode functions
 */
function init( params ) {
    // extract parameters for convenience
    let { log } = params;

    // todo: declare state for accessory instance (available from encode/decode function definitions below)

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
    function encode( message, info, output ) { // eslint-disable-line no-unused-vars
        log( `empty-codec: encode() called for topic [${info.topic}], property [${info.property}] with message [${message}]` );
        // todo: manipulate message
        return message;
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
        log( `empty-codec: decode() called for topic [${info.topic}], property [${info.property}] with message [${message}]` );
        // todo: manipulate message
        return message;
    }

    // todo: define separate encode/decode functions for specific properties

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
        encode, 
        decode 
    };
}

// export initialisation function
module.exports = {
    init
};
