'use strict';

const Uuidv4 = require('uuid/v4');

const Publisher = require('./Publisher');
const Consumer  = require('./Consumer');
const Emittery  = require('emittery');

/**
 * @Type RPCPublisher
 */
class RPCPublisher extends Emittery {

    constructor(connection, options) {

        super();

        this.configurations = options;
        this.connection     = connection;
        this.consumers      = [];
    }

    /**
     * @private
     * @param queue
     * @param correlationId
     * @return {Promise<any>}
     */
    async subscribe(queue, correlationId) {

        const responsePromise = new Promise((fulfil) => {

            this.consumers[queue] = new Consumer(this.connection, {
                queue    : {
                    name    : queue,
                    options : {
                        exclusive  : true,
                        autoDelete : true
                    }
                },
                consumer : {
                    receiveFunc : (response) => {

                        if (response.properties.correlationId === correlationId) {
                            fulfil(response);
                        }
                    }
                }
            });

            this.consumers[queue].onAny((event, data) => this.emit(event, data));

            this.consumers[queue].subscribe();
        });

        const response = await responsePromise;

        await this.consumers[queue].close();

        delete this.consumers[queue];

        return response;
    }

    /**
     * Send the message and return the response.
     *
     * @param message
     * @return {Promise<*>}
     */
    async publish(message) {

        const msg = Publisher.prepareMessage(message);

        msg.options.correlationId = Uuidv4();
        msg.options.replyTo       = Uuidv4();

        const response = this.subscribe(msg.options.replyTo, msg.options.correlationId);

        await new Publisher(await this.connection.getChannel(), {
            exchange   : this.configurations.exchange,
            queue      : this.configurations.queue,
            routingKey : this.configurations.routingKey
        }).publish(msg);

        return response;
    }
}

module.exports = RPCPublisher;
