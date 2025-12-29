import { redis } from '@/lib/redis'
import { Elysia } from 'elysia'
import { nanoid } from 'nanoid'
import { authMiddleware } from './auth'
import { z } from 'zod'
import type { Message } from '@/lib/realtime'
import { realtime } from '@/lib/realtime'
const rooms = new Elysia ({ prefix: "/room"}).
post("/create", async() => {
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

const messages = new Elysia({prefix: "/message"})
.use(authMiddleware) 
.post("/", async ({body, set, query, roomId: derivedRoomId, token: derivedToken}) => {
    try {
        const {sender, text} = body
        
        // Get roomId and token from derived context or query
        const roomId = derivedRoomId || query?.roomId
        const token = derivedToken

        if(!roomId || !token) {
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

export type App = typeof app