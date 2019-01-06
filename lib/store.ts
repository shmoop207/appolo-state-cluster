import {DefaultOptions, IOptions, SetStateOptions} from "./IOptions";
import {EventDispatcher} from "appolo-event-dispatcher";
import {Client} from "./client";
import * as _ from 'lodash'
import {IEventOptions} from "appolo-event-dispatcher/lib/IEventOptions";
import {Util} from "./util";


export class Store<T extends { [index: string]: any }> extends EventDispatcher {

    private _client: Client<T>;
    private readonly _options: IOptions;

    private _isLocked = false;

    constructor(private initialState: T = {} as T, options: IOptions) {

        super();

        this._options = Object.assign({}, DefaultOptions, options);


        this._client = new Client(options);
    }

    public async initialize(): Promise<void> {
        await this._client.connect();

        await this._client.initState(this.initialState);


        this._client.on("stateChanged", this._onStateChanged, this);
        this._client.on("publishEvent", this._onPublish, this);

    }

    private _onStateChanged(state: T) {
        this.fireEvent("stateChanged", state)
    }

    private _onPublish(message: { name: string, data: any }) {
        this.fireEvent(message.name, message.data);

    }

    public get state(): Promise<T> {
        return this._client.state();
    }

    public get statesCount(): Promise<number> {
        return this._client.statesCount();
    }

    public get stateSync(): T {
        return this._client.stateSync();
    }

    public get states(): AsyncIterableIterator<T> {

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

    public once(event: string, fn?: (...args: any[]) => any, scope?: any, options: IEventOptions = {}): Promise<T> {
        return super.once(event, fn, scope, options) as  Promise<T>
    }


    public stateAt(index: number): Promise<T> {
        return this._client.stateAt(index);
    }


    public async setState(value: Partial<T> | T, options: SetStateOptions = {arrayMerge: "concat", override: false}) {

        if (options.override) {
            await this._client.setState(value as T);

            this._isLocked = false;

            return;
        }

        let state = await (this._isLocked ? this.state : this.lock());

        state = _.mergeWith(state, value, options.arrayMerge == "concat" ? Util.arrayConcat : null);

        await this._client.setState(state as T);

        this._isLocked = false;

    }

    public async increment(path: string, inc: number): Promise<void> {

        let state = await this.lock();

        let counter = parseFloat(_.get(state, path)) || 0;

        _.set(state, path, counter + inc);

        await this.setState(state, {override: true});
    }

    public async lock(timeMilli = 5000, retryMilli = 5): Promise<T> {

        let state = await this._client.lock(timeMilli, retryMilli);

        this._isLocked = true;

        setTimeout(() => this._isLocked = false, timeMilli);

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
        await this._client.reset(state)

    }

    public async publish(name: string, data: any) {
        await this._client.publish(name, data)
    }

    public async quit() {
        this._client.removeAllListeners();
        await this._client.quit()

    }

}