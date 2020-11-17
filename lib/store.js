"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Store = void 0;
const IOptions_1 = require("./IOptions");
const events_1 = require("@appolo/events");
const client_1 = require("./client");
const util_1 = require("./util");
const _ = require("lodash");
const utils_1 = require("@appolo/utils");
class Store {
    constructor() {
        this._isLocked = false;
        this._initialState = {};
        this._dispatcher = new events_1.EventDispatcher();
    }
    setInitialState(value) {
        this._initialState = value;
        return this;
    }
    setOptions(options) {
        this._options = options;
        return this;
    }
    async initialize() {
        this._options = Object.assign({}, IOptions_1.DefaultOptions, this._options || {});
        this._client = new client_1.Client(this._options);
        await this._client.connect();
        await this._client.initState(this._initialState);
        this._client.on("stateChanged", this._onStateChanged, this);
        return this;
    }
    _onStateChanged(state, keys) {
        this._dispatcher.fireEvent("stateChanged", { state });
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            this._dispatcher.fireEvent(key, { state, value: state[key] });
        }
    }
    once(type, fn, scope, options = {}) {
        let result = this._dispatcher.once.apply(this._dispatcher, arguments);
        return fn ? this : result;
    }
    un(type, fn, scope) {
        this._dispatcher.un.apply(this._dispatcher, arguments);
        return this;
    }
    on(type, fn, scope, options) {
        this._dispatcher.on.apply(this._dispatcher, arguments);
        return this;
    }
    removeListenersByScope(scope) {
        this._dispatcher.removeListenersByScope(scope);
    }
    removeAllListeners() {
        this._dispatcher.removeAllListeners();
    }
    getState() {
        return this._client.state();
    }
    get statesCount() {
        return this._client.statesCount();
    }
    states() {
        let $self = this, index = -1;
        return {
            [Symbol.asyncIterator]() {
                return this;
            },
            async next() {
                index++;
                let { state, length } = await $self._client.stateAtData(index);
                if (index == length) {
                    return { value: undefined, done: true };
                }
                return { value: state, done: false };
            }
        };
    }
    stateAt(index) {
        return this._client.stateAt(index);
    }
    async setState(value, options) {
        if (!options) {
            options = IOptions_1.SetStateDefaults;
        }
        else {
            options = Object.assign({}, IOptions_1.SetStateDefaults, options);
        }
        if (options.override) {
            await this._client.setState(value);
            this._isLocked = false;
            return;
        }
        let state = await ((this._isLocked || !options.lock) ? this.getState() : this.lock());
        state = _.mergeWith(state, value, options.arrayMerge == "concat" ? util_1.Util.arrayConcat : null);
        await this._client.setState(state);
        this._isLocked = false;
    }
    async increment(path, inc) {
        let state = await this.lock();
        let counter = parseFloat(_.get(state, path)) || 0;
        _.set(state, path, counter + inc);
        await this.setState(state, { override: true });
    }
    async lock(timeMilli = 5000, retryMilli = 5) {
        if (this._isLocked) {
            await utils_1.Promises.delay(retryMilli);
            return this.lock(timeMilli, retryMilli);
        }
        let state = await this._client.lock(timeMilli, retryMilli);
        this._isLocked = true;
        this._lockedInterval = setTimeout(() => this._isLocked = false, timeMilli);
        return state;
    }
    get prevState() {
        return this._client.stateAt(0, -1);
    }
    async goToPrevState() {
        await this._client.goToState(0, -1);
    }
    get nextState() {
        return this._client.stateAt(0, 1);
    }
    async goToNextState() {
        await this._client.goToState(0, 1);
    }
    async goToState(index) {
        await this._client.goToState(index);
    }
    async reset(state) {
        if (state) {
            this._initialState = state;
        }
        await this._client.reset(this._initialState);
    }
    async publish(name, data) {
        await this._client.publish(name, data);
    }
    async quit() {
        clearTimeout(this._lockedInterval);
        this._client.removeAllListeners();
        await this._client.quit();
    }
}
exports.Store = Store;
//# sourceMappingURL=store.js.map