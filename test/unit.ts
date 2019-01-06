import chai = require("chai");
import {action, IOptions, Store} from "../index"

let should = chai.should();

function delay(time) {
    return new Promise((resolve,) => {
        setTimeout(resolve, time)
    })
}

const RedisConn = process.env.REDIS

let RedisParams = {
    maxStates: 5,
    redis: RedisConn,
    name: "test"
}

interface IState {
    counter: number
}


describe("State", () => {

    let store: Store<IState>;

    beforeEach(async () => {
        store = new Store<IState>({counter: 0}, RedisParams)

        await store.initialize();

        await store.reset({counter: 0});
    });

    afterEach(async () => {
        await store.quit();
    });

    it("Should  init  state", async () => {


        (await store.state).counter.should.be.eq(0);
    });

    it("Should  set state", async () => {


        await store.setState({counter: 1});

        (await store.state).counter.should.be.eq(1);

    });


    it("Should  set state multi store", async () => {


        let store2 = new Store<{ counter: number }>({counter: 0}, RedisParams);

        await Promise.all([store2.initialize()]);

        await store.setState({counter: 1});

        (await store.state).counter.should.be.eq(1);
        (await store2.state).counter.should.be.eq(1);

        await store.reset();

        (await store2.state).counter.should.be.eq(0);
    });


    it("Should  not change  state", async () => {


        (await store.state).counter++;

        (await store.state).counter.should.be.eq(0);
    });


    it("Should fire event on state change", async () => {


         store.setState({counter: 1});

        let state: IState = await store.once("stateChanged");

        state.counter.should.be.eq(1);

        await store.reset();


    });

    it("Should fire event on 2 stores state change", async () => {

        let store2 = new Store<{ counter: number }>({counter: 0}, RedisParams);


        await Promise.all([store2.initialize()]);

         store.setState({counter: 1});

        let state = await store2.once("stateChanged");

        state.counter.should.be.eq(1);

        await store.reset();

    });


    it("Should iterate", async () => {


        await store.setState({counter: 1});
        await store.setState({counter: 2});

        let count = 0;

        for await (let state of  store.states) {
            count += state.counter;
        }

        count.should.be.eq(3);

        (await (store.states as any).next()).value.counter.should.be.eq(0);

        await store.reset();

    });

    it("Should go to prev state", async () => {

        await store.setState({counter: 1});
        await store.setState({counter: 2});
        await store.setState({counter: 3});

        (await store.prevState).counter.should.be.eq(2);


    });

    it("Should go to next state", async () => {


        await store.setState({counter: 1});
        await store.setState({counter: 2});
        await store.setState({counter: 3});

        await store.goToPrevState();

        (await store.state).counter.should.be.eq(2);

        (await store.prevState).counter.should.be.eq(1);
        (await store.nextState).counter.should.be.eq(3);

        await store.goToNextState();

        (await store.state).counter.should.be.eq(3);

        (await store.prevState).counter.should.be.eq(2);
        (await store.nextState).counter.should.be.eq(3);

    });
    //
    it("Should go to  state by index and set State", async () => {


        await store.setState({counter: 1});
        await store.setState({counter: 2});
        await store.setState({counter: 3});

        await store.goToState(2);

        (await store.state).counter.should.be.eq(2);

        (await store.prevState).counter.should.be.eq(1);
        (await store.nextState).counter.should.be.eq(3);

    });

    it("Should go to  state by index", async () => {


        await store.setState({counter: 1});
        await store.setState({counter: 2});
        await store.setState({counter: 3});

        await store.goToState(2);

        await store.setState({counter: 4});

        (await store.state).counter.should.be.eq(4);

        (await store.prevState).counter.should.be.eq(2);
        (await store.nextState).counter.should.be.eq(4);

    });

    it("Should go to  state by bigger index ", async () => {


        await store.setState({counter: 1});
        await store.setState({counter: 2});
        await store.setState({counter: 3});
        await store.setState({counter: 4});

        await store.goToState(1);

        await store.setState({counter: 5});

        await store.setState({counter: 6});

        (await store.state).counter.should.be.eq(6);

        (await store.stateAt(2)).counter.should.be.eq(5);
        (await store.stateAt(1)).counter.should.be.eq(1);
        (await store.nextState).counter.should.be.eq(6);
        (await store.prevState).counter.should.be.eq(5);

    });


    it("Should go to reset ", async () => {

        await store.setState({counter: 1});
        await store.setState({counter: 2});
        await store.setState({counter: 3});
        await store.setState({counter: 4});

        await store.goToState(1);

        await store.reset();

        (await store.state).counter.should.be.eq(0);

        (await store.stateAt(2)).counter.should.be.eq(0);
        (await store.nextState).counter.should.be.eq(0);
        (await store.prevState).counter.should.be.eq(0);

    });


    it("Should go to remove old states ", async () => {


        await Promise.all([store.setState({counter: 1}),
            store.setState({counter: 2}),
            store.setState({counter: 3}),
            store.setState({counter: 4}),
            store.setState({counter: 5}),
            store.setState({counter: 6})]);


        (await store.state).counter.should.be.eq(6);

        (await store.stateAt(0)).counter.should.be.eq(2);

    });

    it("Should fire action event", async () => {

        class TempStore extends Store<{ counter: number }> {

            constructor(options: IOptions) {
                super({counter: 0}, options)
            }

            @action()
            async setCounter(value) {
                await this.setState({counter: value});
            }
        }

        let store = new TempStore(RedisParams);

        await store.initialize();


        await store.setCounter(5);

        let state = await store.once("setCounter");

        state.counter.should.be.eq(5);

    });


    it("Should merge state", async () => {

        class TempStore extends Store<any> {

            constructor(options: IOptions) {
                super({item: {item2: 1}}, options)
            }

            @action()
            async setCounter(value) {
                await this.setState({item: {item3: value}});
            }
        }

        let store = new TempStore(RedisParams);

        await store.initialize();

        store.setCounter(5);

        await store.setCounter(5);

        let state = await store.once("setCounter")

        state.item.item3.should.be.eq(5);

    });

    it("Should setState concurrent", async () => {

        await Promise.all([
            store.setState({counter: 1, b: 1} as any),
            store.setState({counter: 2, a: 1} as any),
            store.setState({counter: 3, c: 1} as any),
            store.setState({counter: 4, d: 1} as any)]);


        let state: any = await store.state;

        state.counter.should.be.eq(4)
        state.b.should.be.eq(1)
        state.a.should.be.eq(1)
        state.c.should.be.eq(1)
        state.d.should.be.eq(1)


    });

    it("Should setState concurrent", async () => {

        let store2 = new Store<{ counter: number }>({counter: 0}, RedisParams);
        let store3 = new Store<{ counter: number }>({counter: 0}, RedisParams);


        await Promise.all([store2.initialize(), store3.initialize()]);

        function inc(store: Store<{ counter: number }>) {
            return new Promise(async (resolve, reject) => {

                let state = await store.lock();

                state.counter++;

                await store.setState(state);

                resolve();
            })
        }

        await Promise.all([
            inc(store), inc(store2), inc(store3)]);


        let state: any = await store.state;

        state.counter.should.be.eq(3)

        await Promise.all([
            store2.quit(), store3.quit()]);
    });

    it("Should increment concurrent", async () => {

        let store2 = new Store<{ counter: number }>({counter: 0}, RedisParams);
        let store3 = new Store<{ counter: number }>({counter: 0}, RedisParams);


        await Promise.all([store2.initialize(), store3.initialize()]);


        await Promise.all([
            store.increment("counter", 1), store3.increment("counter", 2), store2.increment("counter", 3)]);


        let state: any = await store.state;

        state.counter.should.be.eq(6)
    });


});

