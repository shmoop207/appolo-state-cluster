import {DefaultOptions, IOptions, SetStateDefaults, SetStateOptions} from "./IOptions";
import {EventDispatcher} from "@appolo/events";
import {Client} from "./client";
import {IEventOptions} from "@appolo/events";
import {Util} from "./util";
import * as _ from "lodash";
import {Promises} from "@appolo/utils";
import Timer = NodeJS.Timer;

export type EventParams<T extends { [index: string]: any }, K extends keyof T> = { value?: T[K], state: T };

export class Store<T extends { [index: string]: any }> {

    private _client: Client<T>;
    private _options: IOptions;

    private _lockedInterval: Timer;
    private _isLocked = false;
    protected _initialState: T = {} as T;

    private _dispatcher = new EventDispatcher();

    public setInitialState(value: T): this {
        this._initialState = value;
        return this
    }

    public setOptions(options: IOptions): this {
        this._options = options;
        return this
    }

    public async initialize(): Promise<this> {

        this._options = Object.assign({}, DefaultOptions, this._options || {} as any);


        this._client = new Client(this._options);

        await this._client.connect();

        await this._client.initState(this._initialState);


        this._client.on("stateChanged", this._onStateChanged, this);

        return this;
    }

    private _onStateChanged(state: T, keys: string) {

        this._dispatcher.fireEvent("stateChanged", {state})
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            this._dispatcher.fireEvent(key, {state, value: state[key]})

        }
    }

    // private _onPublish(message: { name: string, data: any }) {
    //     this.fireEvent(message.name, message.data);
    //
    // }

    public once<K extends string & keyof (T & { stateChanged })>(type: `K`): Promise<EventParams<T, K>>
    public once<K extends keyof (T & { stateChanged })>(type: K, fn?: undefined | null, scope?: any, options?: IEventOptions): Promise<EventParams<T, K>>
    public once<K extends keyof (T & { stateChanged })>(type: K, fn?: (params: EventParams<T, K>) => any, scope?: any, options: IEventOptions = {}) {
        let result = this._dispatcher.once.apply(this._dispatcher, arguments)

        return fn ? this : result
    }

    public un<K extends keyof T>(type: K, fn: (params: EventParams<T, K>) => any, scope?: any): this {
        this._dispatcher.un.apply(this._dispatcher, arguments);
        return this;
    }

    public on<K extends keyof (T & { stateChanged })>(type: K, fn: (params: EventParams<T, K>) => any, scope?: any, options?: IEventOptions): this {
        this._dispatcher.on.apply(this._dispatcher, arguments);
        return this
    }

    public removeListenersByScope(scope: any): void {
        this._dispatcher.removeListenersByScope(scope)
    }

    public removeAllListeners(): void {
        this._dispatcher.removeAllListeners();
    }


    public getState(): Promise<T> {
        return this._client.state();
    }

    public get statesCount(): Promise<number> {
        return this._client.statesCount();
    }

    public states(): AsyncIterableIterator<T> {

        let $self = this, index = -1;

        return {
            [Symbol.asyncIterator]() {
                return this;
            },
            async next(): Promise<{ done: boolean, value: T }> {

                index++;
                let {state, length} = await $self._client.stateAtData(index);

                if (index == length) {
                    return {value: undefined, done: true}
                }

                return {value: state, done: false};
            }
        }
    }


    public stateAt(index: number): Promise<T> {
        return this._client.stateAt(index);
    }

    public async set<K extends string & keyof T>(key: K, value: T[K], options?: SetStateOptions): Promise<T> {

        let dto: Partial<T> = {};

        dto[key] = value;

        return this.setState(dto, options);
    }

    public async setState(value: Partial<T> | T, options?: SetStateOptions): Promise<T> {

        if (!options) {
            options = SetStateDefaults
        } else {
            options = Object.assign({}, SetStateDefaults, options)
        }

        if (options.override) {
            await this._client.setState(value as T);
            this._isLocked = false;
            return;
        }

        let state = await ((this._isLocked || !options.lock) ? this.getState() : this.lock());

        state = _.mergeWith(state, value, options.arrayMerge == "concat" ? Util.arrayConcat : null);

        await this._client.setState(state as T);

        this._isLocked = false;

        return state

    }

    public async increment(path: string, inc: number): Promise<void> {

        let state = await this.lock();

        let counter = parseFloat(_.get(state, path)) || 0;

        _.set(state, path, counter + inc);

        await this.setState(state, {override: true});
    }

    public async lock(timeMilli = 5000, retryMilli = 5): Promise<T> {

        if (this._isLocked) {
            await Promises.delay(retryMilli);
            return this.lock(timeMilli, retryMilli)
        }


        let state = await this._client.lock(timeMilli, retryMilli);
        this._isLocked = true;

        this._lockedInterval = setTimeout(() => this._isLocked = false, timeMilli);

        return state
    }

    public get prevState(): Promise<T> {
        return this._client.stateAt(0, -1);
    }


    public async goToPrevState() {
        await this._client.goToState(0, -1);
    }

    public get nextState(): Promise<T> {
        return this._client.stateAt(0, 1);
    }


    public async goToNextState() {
        await this._client.goToState(0, 1);
    }

    public async goToState(index: number) {

        await this._client.goToState(index);

    }

    public async reset(state?: T) {
        if (state) {
            this._initialState = state;
        }

        await this._client.reset(this._initialState)

    }


    public async quit() {
        clearTimeout(this._lockedInterval);
        this._client.removeAllListeners();
        await this._client.quit()

    }

}
