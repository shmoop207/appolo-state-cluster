local queueName = string.format("queue_{%s}", KEYS[1])
local indexName = string.format("queue_index_{%s}", KEYS[1])
local initialName = string.format("queue_initial_{%s}", KEYS[1])

local len = redis.call('LLEN', queueName)

if (len == 0) then
    len = redis.call('RPUSH', queueName, ARGV[1])
    redis.call('SET', indexName, 0)
    redis.call('SET', initialName, ARGV[1])
end

local state = redis.call('LINDEX', queueName, - 1)
local index = redis.call('GET', indexName)

return { state, index }
