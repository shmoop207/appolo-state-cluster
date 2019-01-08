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
}

export let DefaultOptions: Partial<IOptions> = {
    maxStates: 1,
    cache: true,
    cacheTime: 60 * 1000
}

export interface SetStateOptions {
    override?: boolean,
    arrayMerge?: "override" | "concat"
}