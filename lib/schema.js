'use strict';

const Joi = require('joi');

module.exports.exchange = Joi.object().keys({
    name    : Joi.string(),
    type    : Joi.string().default('fanout').valid(['direct', 'fanout', 'topic', 'header']),
    options : Joi.object().keys({
        durable           : Joi.boolean().default(true),
        internal          : Joi.boolean().default(false),
        autoDelete        : Joi.boolean().default(false),
        alternateExchange : Joi.string(),
        arguments         : Joi.object()
    })
});

module.exports.queue = Joi.object().keys({
    name    : Joi.string(),
    options : Joi.object().keys({
        exclusive            : Joi.boolean().default(false),
        durable              : Joi.boolean().default(true),
        autoDelete           : Joi.boolean().default(false),
        arguments            : Joi.object(),
        messageTtl           : Joi.number().integer().positive(),
        expires              : Joi.number().integer().positive(),
        deadLetterExchange   : Joi.string(),
        deadLetterRoutingKey : Joi.string(),
        maxLength            : Joi.number().integer().positive(),
        maxPriority          : Joi.number().integer().positive()
    })
});
