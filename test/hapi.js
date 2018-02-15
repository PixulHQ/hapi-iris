'use strict';

const Code = require('code');
const Hapi = require('hapi');
const Hoek = require('hoek');

const Lab = require('lab');

const lab = exports.lab = Lab.script();
const { describe, it } = lab;
const expect           = Code.expect;

const Rabbit = require('..');

describe('register()', () => {

    const provisionServer = async (options) => {

        const defaults = {};
        const server   = new Hapi.Server();
        await server.register({ plugin : Rabbit, options : Hoek.applyToDefaults(defaults, options || {}) });
        return server;
    };

    it('Can access to different method', async () => {

        const server = await provisionServer();

        expect(server.rabbit).to.be.an.object();

        expect(server.rabbit.subscribe).to.be.a.function();
        expect(server.rabbit.publish).to.be.a.function();
        expect(server.rabbit.subscribeRPC).to.be.a.function();
        expect(server.rabbit.publishRPC).to.be.a.function();

        expect(server.rabbit.Publisher).to.be.a.function();
        expect(server.rabbit.RPCPublisher).to.be.a.function();
        expect(server.rabbit.RPCConsumer).to.be.a.function();
        expect(server.rabbit.Consumer).to.be.a.function();
        expect(server.rabbit.connection).to.be.a.object();
    });
});
