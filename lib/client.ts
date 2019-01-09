import Redis = require("ioredis");
import path = require("path");
import fs = require("fs");
import _ = require("lodash");
import {IOptions} from "./IOptions";
import {EventDispatcher} from "appolo-event-dispatcher";
import {Util} from "./util";

const {promisify} = require('util');


export class Client<T> extends EventDispatcher {

    private _client: Redis.Redis;
    private _sub: Redis.Redis;

    private _stateHash: string;

    private _interval = null;
    private _isValidCache: boolean;

    private readonly _publishStateEventName: string;
    private readonly _publishEventName: string;


    private readonly Scripts = [{
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

    constructor(private _options: IOptions) {
        super();

        this._publishStateEventName = `queue_publish_state_${this._options.name}`;
        this._publishEventName = `queue_publish_{${this._options.name}}`
    }


    public async connect(): Promise<void> {

        let params = {enableReadyCheck: true, lazyConnect: true, keepAlive: 1000};

        this._client = this._options.redisClient || new Redis(this._options.redis, params);
        this._sub = this._options.redisPubSub || new Redis(this._options.redis, params);

        await this.loadScripts();

        this._client.on("reconnecting", this._onConnectionClose.bind(this));
        this._client.on("close", this._onConnectionClose.bind(this));
        this._client.on("end", this._onConnectionClose.bind(this));
        this._client.on("connect", this._onConnectionOpen.bind(this));

        if (!this._options.redisClient) {
            await Promise.all([this._client.connect(), this._sub.connect()]);
        }

        this._sub.on("message", this._onMessage.bind(this));

        await Promise.all([this._sub.subscribe(this._publishStateEventName),this._sub.subscribe(this._publishEventName)]);


    }

    private _onConnectionClose() {

    }

    private async _onConnectionOpen() {
    }

    private async loadScripts() {

        await Promise.all(_.map(this.Scripts, async script => {
            if (this._client[script.name]) {
                return;
            }

            let lua = await promisify(fs.readFile)(path.resolve(__dirname, "lua", `${script.name}.lua`), {encoding: "UTF8"})

            this._client.defineCommand(script.name, {
                numberOfKeys: script.args,
                lua: lua
            });
        }));

    }


    public async initState(state: T): Promise<void> {

        await (this._client as any).init(this._options.name, JSON.stringify(state));

        this._stateHash = await this._getStateHash();

        this._refreshState(this._stateHash)
    }


    public async setState(state: T): Promise<void> {

        let dto = JSON.stringify(state);

        await (this._client as any).setState(this._options.name, dto, this._options.maxStates);

        this._refreshState(dto)
    }

    public async stateAt(index: number, increment = 0): Promise<T> {
        let {state} = await this.stateAtData(index, increment);

        return state
    }

    public async stateAtData(index: number, increment = 0): Promise<{ state: T, length: number }> {
        let [state, currentIndex, len] = await (this._client as any).stateAt(this._options.name, index, increment || 0);

        return {state: JSON.parse(state), length: len}
    }

    public async goToState(index: number, increment = 0): Promise<void> {
        await (this._client as any).goToState(this._options.name, index, increment || 0);
        this._isValidCache = false;
    }


    private async _getStateHash(): Promise<string> {
        let [state] = await (this._client as any).state(this._options.name);

        return state;
    }

    public async state(): Promise<T> {

        let stateHash: string;

        if (this._options.cache && this._isValidCache) {
            stateHash = this._stateHash;
        } else {
            stateHash = await this._getStateHash();
            this._refreshState(stateHash);
        }

        return JSON.parse(stateHash)
    }

    public async statesCount(): Promise<number> {
        return this._client.llen(`queue_{${this._options.name}}`)
    }

    public async publish(name: string, data: any) {

        let dto = {
            name: name,
            data: data
        }

        await this._client.publish(`queue_publish_{${this._options.name}}`, JSON.stringify(dto))
    }


    private _onMessage(channel: string, message: string) {

        switch (channel) {
            case this._publishStateEventName:
                this._handleState(message);
                break;
            case this._publishEventName:

                this._handlePublish(message);
                break;
        }

    }

    private _handleState(message: string) {

        this._refreshState(message)

    }

    public async lock(lockTimeMilli = 5000, lockRetryMilli = 5): Promise<T> {
        let [stateHash, isLocked] = await (this._client as any).state(this._options.name, "true", Math.ceil(lockTimeMilli / 1000));

        if (!isLocked) {

            this._refreshState(stateHash);

            return JSON.parse(stateHash)
        }

        await Util.delay(lockRetryMilli);

        return this.lock(lockTimeMilli, lockRetryMilli);

    }

    private async _refreshState(newState?: string) {

        try {
            clearTimeout(this._interval);

            let oldState = this._stateHash;

            if (newState) {
                this._stateHash = newState
            } else {
                this._stateHash = await this._getStateHash()
            }

            this._isValidCache = true;
            setTimeout(() => this._isValidCache = false, this._options.cacheTime);

            if (oldState != this._stateHash) {
                process.nextTick(() => this.fireEvent("stateChanged", JSON.parse(this._stateHash)))
            }

            this._interval = setTimeout(() => this._refreshState(), 10 * 1000)
        } catch (e) {

        }


    }

    private _handlePublish(message: string) {
        let dto: { name: string, data: any } = JSON.parse(message);

        this.fireEvent("publishEvent", dto)

    }

    public async reset(state?: T) {
        let [stateHash] = await (this._client as any).reset(this._options.name, JSON.stringify(state), !!state);
        this._refreshState(stateHash);

    }


    public async quit() {
        clearTimeout(this._interval);
        this._client.removeAllListeners();
        await Promise.all([this._client.quit(), this._sub.quit()]);

    }

}