'use strict';

const EventEmitter = require('events').EventEmitter;
const Joi          = require('joi');

const Schema = require('./schema');

class Publisher extends EventEmitter {

    constructor(channel, options) {

        super();

        this.configurations = Joi.attempt(options, Joi.object().keys({
            exchange   : Schema.exchange,
            queue      : Schema.queue,
            routingKey : Joi.string()
        }).xor('exchange', 'queue'), 'Publisher configuration is not valid');

        this.channel = channel;
    }

    /**
     * Send the message on the queue/exchange using the configuration given to the Publisher at his creation.
     * @param message
     * @return {Promise<void>}
     */
    async publish(message) {

        const msg = Publisher.prepareMessage(message);

        if (this.configurations.exchange) {
            await this.channel.assertExchange(this.configurations.exchange.name, this.configurations.exchange.type, this.configurations.exchange.options);

            return await this.channel.publish(this.configurations.exchange.name, this.configurations.routingKey, msg.content, msg.options);
        }

        const destinationQueue = await this.channel.assertQueue(this.configurations.queue.name, this.configurations.queue.options);

        return await this.channel.publish('', destinationQueue.queue, msg.content, msg.options);
    }

    /**
     * Convert a String message to an object message if needed
     * @param {Object|String|string} message
     * @return {*}
     */
    static prepareMessage(message) {

        let newMessage = message;

        if (typeof message === 'string' || message instanceof String) {
            newMessage = { content : message.toString() };
        }

        newMessage         = Joi.attempt(newMessage, Publisher.messageSchema);
        newMessage.content = new Buffer(newMessage.content);

        return newMessage;
    }

    static get messageSchema() {

        return Joi.object().keys({
            content : Joi.string().required(),
            options : Joi.object().keys({
                contentType     : Joi.string().default('application/json'),
                persistent      : Joi.boolean().default(true),
                expiration      : Joi.string(),
                userId          : Joi.string(),
                CC              : Joi.string(),
                priority        : Joi.string(),
                deliveryMode    : Joi.string(),
                mandatory       : Joi.string(),
                BCC             : Joi.string(),
                immediate       : Joi.string(),
                contentEncoding : Joi.string(),
                headers         : Joi.string(),
                correlationId   : Joi.string(),
                replyTo         : Joi.string(),
                messageId       : Joi.string(),
                timestamp       : Joi.string(),
                type            : Joi.string(),
                appId           : Joi.string()
            })
        });
    }
}

module.exports = Publisher;
