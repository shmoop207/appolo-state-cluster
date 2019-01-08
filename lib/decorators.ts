import "reflect-metadata";


export function action(name?: string): (target: any, propertyKey: string, descriptor?: PropertyDescriptor) => void {

    return function (target: any, propertyKey: string, descriptor?: PropertyDescriptor) {

        let methodName = "value";

        let method = descriptor[methodName];

        descriptor[methodName] = async function () {
            let result = method.apply(this, arguments);

            if (result instanceof Promise) {
                result = await result;
            }

            let state = await this.state();

            this.publish(name || propertyKey, state);

            return result;
        }
    }

}

export function transaction(lockTimeMilli = 5000, lockRetryMilli = 5): (target: any, propertyKey: string, descriptor?: PropertyDescriptor) => void {

    return function (target: any, propertyKey: string, descriptor?: PropertyDescriptor) {

        let method = descriptor["value"];

        descriptor["value"] = async function () {

            let state = await this.lock(lockTimeMilli, lockRetryMilli);

            return method.apply(this, [...arguments,state]);


        }
    }

}