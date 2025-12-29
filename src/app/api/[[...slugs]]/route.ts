import { redis } from '@/lib/redis'
import { Elysia } from 'elysia'
import { nanoid } from 'nanoid'
import { authMiddleware } from '@/api/[[..slugs]]/auth'
import { z } from 'zod'
import type { Message } from '@/lib/realtime'
import { realtime } from '@/lib/realtime'

const rooms = new Elysia ({ prefix: "/room"})
.post("/create", async() => {
    const roomId = nanoid()

    await redis.hset(`meta:${roomId}`, {
        connected: JSON.stringify([]),
        createdAt: Date.now(),
        })

        await redis.expire(`meta:${roomId}`, 10 * 60) // 10 minutes

        return {
            roomId,
        }
})
.use(authMiddleware)
.get("/ttl", async ({roomId: derivedRoomId, token: derivedToken, query, set}) => {
    try {
        const roomId = derivedRoomId || query?.roomId

        if(!roomId || !derivedToken) {
            set.status = 401
            return {error: "Unauthorized"}
        }

        const roomExists = await redis.exists(`meta:${roomId}`)
        if(!roomExists) {
            set.status = 404
            return {error: "Room not found"}
        }

        const ttl = await redis.ttl(`meta:${roomId}`)
        return {ttl: ttl >= 0 ? ttl : 0}
    } catch (error) {
        console.error("Get TTL error:", error)
        set.status = 500
        return {error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error"}
    }
}, {
    query: z.object({roomId: z.string()})
})
.delete("/destroy", async ({roomId: derivedRoomId, token: derivedToken, query, set}) => {
    try {
        const roomId = derivedRoomId || query?.roomId

        if(!roomId || !derivedToken) {
            set.status = 401
            return {error: "Unauthorized"}
        }

        const roomExists = await redis.exists(`meta:${roomId}`)
        if(!roomExists) {
            set.status = 404
            return {error: "Room not found"}
        }

        // Delete all Redis keys for the room in parallel
        await Promise.all([
            redis.del(`meta:${roomId}`),
            redis.del(`messages:${roomId}`),
            redis.del(`history:${roomId}`),
            redis.del(roomId)
        ])

        // Emit destroy event to notify all users
        try {
            await realtime.channel(roomId).emit("chat.destroy" as const, { isDestroyed: true })
            console.log("Destroy event emitted successfully for room:", roomId)
        } catch (realtimeError) {
            console.error("Realtime emit error:", realtimeError)
            // Continue even if realtime fails, data is already deleted
        }

        return {success: true, message: "Room destroyed"}
    } catch (error) {
        console.error("Destroy room error:", error)
        set.status = 500
        return {error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error"}
    }
}, {
    query: z.object({roomId: z.string()})
})

const messages = new Elysia({prefix: "/message"})
.use(authMiddleware)
.get("/", async ({roomId: derivedRoomId, token: derivedToken, query, set}) => {
    try {
        // Get roomId from derived context or query
        const roomId = derivedRoomId || query?.roomId

        if(!roomId || !derivedToken) {
            set.status = 401
            return {error: "Unauthorized"}
        }

        const roomExists = await redis.exists(`meta:${roomId}`)
        if(!roomExists) {
            set.status = 404
            return {error: "Room not found"}
        }

        const messagesList = await redis.lrange(`messages:${roomId}`, 0, -1)
        return {
            messages: messagesList.map((m: string | object) => {
                // Handle both string and object cases
                // Upstash Redis may return objects directly or JSON strings
                    let parsed: {id: string, sender: string, text: string, timeStamp: number, token?: string}
                if (typeof m === 'string') {
                    try {
                        parsed = JSON.parse(m) as {id: string, sender: string, text: string, timeStamp: number, token?: string}
                    } catch (e) {
                        console.error("Failed to parse message string:", m, e)
                        return null
                    }
                } else if (typeof m === 'object' && m !== null) {
                    // Already an object, use it directly
                    parsed = m as {id: string, sender: string, text: string, timeStamp: number, token?: string}
                } else {
                    console.error("Unexpected message type:", typeof m, m)
                    return null
                }
                return {
                    id: parsed.id,
                    sender: parsed.sender,
                    text: parsed.text,
                    timeStamp: parsed.timeStamp,
                }
            }).filter((msg) => msg !== null)
        }
    } catch (error) {
        console.error("Get messages error:", error)
        set.status = 500
        return {error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error"}
    }
}, {
    query: z.object({roomId: z.string()})
})
.post("/", async ({body, set, query, roomId: derivedRoomId, token: derivedToken}) => {
    try {
        const {sender, text} = body
        
        // Get roomId and token from derived context or query
        const roomId = derivedRoomId || query?.roomId
        const token = derivedToken

        console.log("Message handler called:", { roomId, token, query, body })

        if(!roomId || !token) {
            console.error("Missing roomId or token:", { roomId, token })
            set.status = 401
            return {error: "Unauthorized"}
        }

        const roomExists = await redis.exists(`meta:${roomId}`)

        if(!roomExists)
        {
            set.status = 401
            return {error: "Room not found"}
        }

        const messageData = {
            id: nanoid(),
            sender,
            text,
            timeStamp: Date.now(),
            token: token
        }

        //Add message to history
        await redis.rpush(`messages:${roomId}`, JSON.stringify(messageData))
        
        const message: Message = {
            id: messageData.id,
            sender: messageData.sender,
            text: messageData.text,
            timeStamp: messageData.timeStamp,
        }
        
        try {
            await realtime.channel(roomId).emit("chat.message" as const, message)
            console.log("Message emitted successfully:", message.id)
        } catch (realtimeError) {
            console.error("Realtime emit error:", realtimeError)
            // Don't fail the request if realtime fails, message is already saved
        }

        //housekeeping
        const remaining = await redis.ttl(`meta:${roomId}`)

        await redis.expire(`messages:${roomId}`, remaining)
        await redis.expire(`history:${roomId}`, remaining)
        await redis.expire(roomId, remaining)

        return {success: true, messageId: message.id}
    } catch (error) {
        console.error("Message send error:", error)
        set.status = 500
        return {error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error"}
    }
}, 
{
    query: z.object({roomId: z.string()}),
    body: z.object({
        sender: z.string().max(100),
        text: z.string().max(1000),
    }),
})

const app = new Elysia({ prefix: '/api' })
.use(rooms)
.use(messages)

export const GET = app.fetch 
export const POST = app.fetch 
export const DELETE = app.fetch

export type App = typeof app