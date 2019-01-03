local queueName = string.format("queue_{%s}", KEYS[1])
local indexName = string.format("queue_index_{%s}", KEYS[1])
local initialName = string.format("queue_initial_{%s}", KEYS[1])
local publishIndexName = string.format("queue_publish_index_%s", KEYS[1])
local publishName = string.format("queue_publish_state_%s", KEYS[1])

redis.call('DEL', queueName)
local state = ARGV[1]

if (ARGV[2] =="false") then
    state = redis.call('GET', initialName)
end

redis.call('RPUSH', queueName, state)
redis.call('SET', indexName, 0)
redis.call('SET', initialName, state)

redis.call("PUBLISH", publishName, state)
redis.call("PUBLISH", publishIndexName, 0)
