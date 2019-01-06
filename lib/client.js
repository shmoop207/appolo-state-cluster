"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Redis = require("ioredis");
const path = require("path");
const fs = require("fs");
const _ = require("lodash");
const appolo_event_dispatcher_1 = require("appolo-event-dispatcher");
const util_1 = require("./util");
const { promisify } = require('util');
class Client extends appolo_event_dispatcher_1.EventDispatcher {
    constructor(_options) {
        super();
        this._options = _options;
        this._interval = null;
        this.Scripts = [{
                name: "init", args: 1
            }, {
                name: "setState", args: 1
            }, {
                name: "reset", args: 1
            }, {
                name: "stateAt", args: 1
            }, {
                name: "state", args: 1
            }, {
                name: "goToState", args: 1
            }];
    }
    async connect() {
        let params = { enableReadyCheck: true, lazyConnect: true, keepAlive: 1000 };
        this._client = new Redis(this._options.redis, params);
        this._sub = new Redis(this._options.redis, params);
        await this.loadScripts();
        this._client.on("reconnecting", this._onConnectionClose.bind(this));
        this._client.on("close", this._onConnectionClose.bind(this));
        this._client.on("end", this._onConnectionClose.bind(this));
        this._client.on("connect", this._onConnectionOpen.bind(this));
        await Promise.all([this._client.connect(), this._sub.connect()]);
        this._sub.subscribe(this._publishStateEventName);
        this._sub.subscribe(this._publishEventName);
        this._sub.on("message", this._onMessage.bind(this));
    }
    _onConnectionClose() {
    }
    async _onConnectionOpen() {
    }
    async loadScripts() {
        await Promise.all(_.map(this.Scripts, async (script) => {
            let lua = await promisify(fs.readFile)(path.resolve(__dirname, "lua", `${script.name}.lua`), { encoding: "UTF8" });
            this._client.defineCommand(script.name, {
                numberOfKeys: script.args,
                lua: lua
            });
        }));
    }
    get _publishStateEventName() {
        return `queue_publish_state_${this._options.name}`;
    }
    get _publishEventName() {
        return `queue_publish_{${this._options.name}}`;
    }
    async initState(state) {
        await this._client.init(this._options.name, JSON.stringify(state));
        this._stateHash = await this._getStateHash();
        this._refreshState(this._stateHash);
    }
    async setState(state) {
        let dto = JSON.stringify(state);
        await this._client.setState(this._options.name, dto, this._options.maxStates);
        this._refreshState(dto);
    }
    async stateAt(index, increment = 0) {
        let { state } = await this.stateAtData(index, increment);
        return state;
    }
    async stateAtData(index, increment = 0) {
        let [state, currentIndex, len] = await this._client.stateAt(this._options.name, index, increment || 0);
        return { state: JSON.parse(state), length: len };
    }
    async goToState(index, increment = 0) {
        await this._client.goToState(this._options.name, index, increment || 0);
    }
    stateSync() {
        return JSON.parse(this._stateHash);
    }
    async _getStateHash() {
        let [state] = await this._client.state(this._options.name);
        return state;
    }
    async state() {
        let state = await this._getStateHash();
        this._refreshState(state);
        return JSON.parse(state);
    }
    async statesCount() {
        return this._client.llen(`queue_{${this._options.name}}`);
    }
    async publish(name, data) {
        let dto = {
            name: name,
            data: data
        };
        await this._client.publish(`queue_publish_{${this._options.name}}`, JSON.stringify(dto));
    }
    _onMessage(channel, message) {
        switch (channel) {
            case this._publishStateEventName:
                this._handleState(message);
                break;
            case this._publishEventName:
                this._handlePublish(message);
                break;
        }
    }
    _handleState(message) {
        this._refreshState(message);
    }
    async lock(lockTimeMilli = 5000, lockRetryMilli = 5) {
        let [stateHash, lock] = await this._client.state(this._options.name, "true", Math.ceil(lockTimeMilli / 1000));
        if (lock != 0) {
            this._refreshState(stateHash);
            return JSON.parse(stateHash);
        }
        await util_1.Util.delay(lockRetryMilli);
        return this.lock(lockTimeMilli, lockRetryMilli);
    }
    async _refreshState(newState) {
        try {
            clearTimeout(this._interval);
            let oldState = this._stateHash;
            if (newState) {
                this._stateHash = newState;
            }
            else {
                this._stateHash = await this._getStateHash();
            }
            if (oldState != this._stateHash) {
                process.nextTick(() => this.fireEvent("stateChanged", JSON.parse(this._stateHash)));
            }
            this._interval = setTimeout(() => this._refreshState(), 10 * 1000);
        }
        catch (e) {
        }
    }
    _handlePublish(message) {
        let dto = JSON.parse(message);
        this.fireEvent("publishEvent", dto);
    }
    async reset(state) {
        await this._client.reset(this._options.name, JSON.stringify(state), !!state);
    }
    async quit() {
        clearTimeout(this._interval);
        this._client.removeAllListeners();
        await Promise.all([this._client.quit(), this._sub.quit()]);
    }
}
exports.Client = Client;
//# sourceMappingURL=client.js.map