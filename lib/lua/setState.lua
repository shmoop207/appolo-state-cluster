local queueName =  string.format("queue_{%s}", KEYS[1])
local indexName =  string.format("queue_index_{%s}", KEYS[1])
local publishName =  string.format("queue_publish_state_%s", KEYS[1])

local len = redis.call('LLEN', queueName);
local index = len - 1;

redis.call("UNLINK",string.format("queue_lock_{%s}", KEYS[1]))

local currentIndex = redis.call("GET", indexName)

if  currentIndex ~= index then
    redis.call('LTRIM', queueName, 0, currentIndex)
    len = redis.call('LLEN', queueName)
end

if (redis.call('LINDEX', queueName, -1) == ARGV[1]) then
    return { index }
end

len = redis.call('RPUSH', queueName, ARGV[1]);


if (len > tonumber(ARGV[2])) then
    redis.call('LTRIM', queueName, 1, -1)
end


index = redis.call('LLEN', queueName) - 1

redis.call("SET", indexName, index)
redis.call("PUBLISH", publishName, ARGV[1])


return { index }
