/**
 * Test 'toggle' codec - toggles switch on receipt of any message
 * toggle.js
 */

'use strict'

module.exports = {
    init: function() {
        let state = false;
        return {
            properties: {
                on: {
                    decode: function() {
                        state = ! state;
                        return state;
                    },
                    encode: function( msg ) {
                        state = msg;
                        return msg;
                    }
                }
            }
        };
    }
};
