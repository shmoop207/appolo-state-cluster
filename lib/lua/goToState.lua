local queueName = string.format("queue_{%s}", KEYS[1])
local indexName = string.format("queue_index_{%s}", KEYS[1])

local len = redis.call('LLEN', queueName)
local index = tonumber(ARGV[1])
local increment = tonumber(ARGV[2])

local oldIndex = redis.call("GET", string.format("queue_index_{%s}", KEYS[1]))

if (increment ~= 0) then
    index = oldIndex + increment
end


if (index <= 0) then
    index = 0
elseif (index > len - 1) then
    index = len - 1
end

redis.call('SET', indexName, index)

if (oldIndex ~= index) then
    redis.call("PUBLISH", string.format("queue_publish_state_%s", KEYS[1]), redis.call('LINDEX', queueName, index))
end

