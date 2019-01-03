local queueName = string.format("queue_{%s}", KEYS[1])

local len = redis.call('LLEN', queueName)
local index = tonumber(ARGV[1])
local increment = tonumber(ARGV[2])

if ( increment ~= 0) then
    index = redis.call("GET", string.format("queue_index_{%s}", KEYS[1])) + increment
end


if (index <= 0) then
    index = 0
elseif (index > len - 1) then
    index = len - 1
end

local state = redis.call('LINDEX', queueName, index)



return { state,index,len }
