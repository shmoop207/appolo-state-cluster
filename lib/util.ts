import {Objects} from '@appolo/utils'

export class Util {


    public static arrayConcat  (objValue:any, srcValue:any) {
        if (Array.isArray(objValue)) {
            return objValue.concat(srcValue);
        }
    }
}

