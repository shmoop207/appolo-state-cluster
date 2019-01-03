local lock

if (ARGV[1] == "true") then
    local lockName = string.format("queue_lock_{%s}", KEYS[1])

     lock = redis.call('SETNX', lockName, 1)

    if (lock == 0) then
        return { "{}", 0 }
    end

     redis.call('EXPIRE', lockName, tonumber(ARGV[2]))
end


local queueName = string.format("queue_{%s}", KEYS[1])
local indexName = string.format("queue_index_{%s}", KEYS[1])

local state = redis.call('LINDEX', queueName, redis.call("GET", indexName))

return { state ,lock}
