export interface IOptions {
    maxStates?: number
    redis: string
    name: string
}

export let DefaultOptions: Partial<IOptions> = {
    maxStates: 1,
}

export interface SetStateOptions {
    override?: boolean,
    arrayMerge?: "override" | "concat"
}