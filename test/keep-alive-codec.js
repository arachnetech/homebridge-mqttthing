/**
 * Test/Demo Homebridge-MQTTThing Codec (encoder/decoder)
 * Codecs allow custom logic to be applied to accessories in mqttthing, rather like apply() functions, 
 * but in the convenience of a stand-alone JavaScript file.
 * 
 * keep-alive-codec.js - sends keep-alive message at configurable interval
 */

'use strict';

module.exports = {
    init: function( params ) {
        let { config, publish } = params;

        // publish keep-alive topic at regular interval
        if( config.keepAliveTopic ) {
            let keepAlivePeriod = config.keepAlivePeriod || 60;
            let keepAliveMessage = config.keepAliveMessage || '';
    
            setInterval( () => {
                publish( config.keepAliveTopic, keepAliveMessage );
            }, keepAlivePeriod * 1000 );
        }
    
        // no encode/decode in this codec
        return {};
    }
};
