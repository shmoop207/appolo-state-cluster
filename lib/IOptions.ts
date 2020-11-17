import Redis = require("ioredis");

export interface IOptions {
    maxStates?: number
    redis: string
    name: string
    redisClient?: Redis.Redis
    redisPubSub?: Redis.Redis
    initial?: number
    cache?: boolean
    cacheTime?: number
    refreshInterval?: number
}

export let DefaultOptions: Partial<IOptions> = {
    maxStates: 1,
    cache: true,
    cacheTime: 60 * 1000,
    refreshInterval:10 *1000

};

export interface SetStateOptions {
    override?: boolean,
    lock?: boolean
    arrayMerge?: "override" | "concat"
}

export let SetStateDefaults:SetStateOptions = {
    override: false,
    lock: true,
    arrayMerge: "concat",

};
