/**
 * Homebridge-MQTTThing JSON Codec (encoder/decoder)
 * codecs/json.js
 * 
 * Add configuration giving JSON 'path' for each property used by the accessory. For example:
 * "jsonConfig": {
 *     "properties": {
 *         "on": "state.power",
 *         "RGB": "state.rgb"
 *     }
 * }
 */

'use strict';

function splitJPath( jpath ) {
    return jpath.split( '.' );
}

function setJson( msg, jpath, val ) {
    let obj = msg;
    let apath = splitJPath( jpath );
    for( let i = 0; i < apath.length - 1; i++ ) {
        let item = apath[ i ];
        if( ! obj.hasOwnProperty( item ) ) {
            obj[ item ] = {};
        }
        obj = obj[ item ];
    }
    obj[ apath[ apath.length - 1 ] ] = val;
}

function getJson( msg, jpath ) {
    let val = msg;
    for( let pi of splitJPath( jpath ) ) {
        if( val.hasOwnProperty( pi ) ) {
            val = val[ pi ];
        } else {
            return;
        }
    }
    return val;
}

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
    let { log, config } = params;
    let jsonConfig = config.jsonCodec;
    if( ! jsonConfig ) {
        log.warn( 'Add jsonCodec object to configuration' );
    }

    let readJPath = function( prop ) {
        if( jsonConfig && jsonConfig.properties ) {
            return jsonConfig.properties[ prop ];
        }
    };

    let emptyMessage = function() {
        if( jsonConfig && jsonConfig.fixed ) {
            return JSON.parse( JSON.stringify( jsonConfig.fixed ) );
        } else {
            return {};
        }
    };

    // pending messages/timers by MQTT topic
    let pending = {};

    // get message object which will be published (automatically)
    let publishMessage = function( topic, publish ) {
        let entry = pending[ topic ];
        if( entry ) {
            // existing entry - clear timer
            clearTimeout( entry.tmr );
        } else {
            // new entry
            entry = pending[ topic ] = { msg: emptyMessage() };
        }

        // publish later
        entry.tmr = setTimeout( () => {
            pending[ topic ] = null;
            publish( JSON.stringify( entry.msg ) );
        }, 50 );

        return entry.msg;
    }

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
        let diag = ! jsonConfig || jsonConfig.diag;
        let jpath = readJPath( info.property );
        if( jpath ) {
            let msg = publishMessage( info.topic, output );
            setJson( msg, jpath, message );
        } else {
            diag = true;
        }
        if( diag ) {
            log( `json-codec: encode() called for topic [${info.topic}], property [${info.property}] with message [${message}]` );
        }
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
        let diag = ! jsonConfig || jsonConfig.diag;
        let jpath = readJPath( info.property );
        let decoded;
        if( jpath ) {
            let msg = JSON.parse( message );
            decoded = getJson( msg, jpath );
        } else {
            diag = true;
        }
        if( diag ) {
            log( `json-codec: decode() called for topic [${info.topic}], property [${info.property}] with message [${message}]` );
        }
        return decoded;
    }

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
