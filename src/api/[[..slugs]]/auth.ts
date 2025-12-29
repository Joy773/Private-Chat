import { Elysia } from 'elysia'
import { redis } from '@/lib/redis'

class AuthError extends Error {
    constructor(message: string){
        super(message);
        this.name = "AuthError";
    }
}

export const authMiddleware = new Elysia({name: "auth"})
.error({ AuthError })
.onError(({code, set}) => {
    if(code === "NOT_FOUND" || code === "AuthError")
    {
        set.status = 401
        return {error: "Unauthorized"}
    }
})
.derive({as: "scoped"}, async ({query, cookie}) => {
    try {
        // Add authentication logic here
        const roomId = query.roomId
        const token = cookie["x-auth-token"]?.value as string | undefined

        console.log("Auth middleware:", { roomId, token: token ? "exists" : "missing" })

        if(!token || !roomId)
        {
            console.error("Auth failed: Missing token or roomId", { roomId, hasToken: !!token })
            throw new AuthError("Missing token or roomId")
        }
        const connected = await redis.hget<string>(`meta:${roomId}`, "connected")
        if(connected === null || connected === undefined)
        {
            console.error("Auth failed: Room not found or no connected array", { roomId })
            throw new AuthError("Unauthorized")
        }
        
        // Handle both JSON string and array formats
        let connectedArray: string[] = []
        try {
            // If it's already an array, use it directly
            if (Array.isArray(connected)) {
                connectedArray = connected
            } 
            // If it's an empty string, treat as empty array
            else if (connected === '' || connected.trim() === '') {
                console.log("Connected is empty string, treating as empty array", { roomId })
                connectedArray = []
            }
            // If it looks like JSON, parse it
            else if (typeof connected === 'string') {
                const trimmed = connected.trim()
                if (trimmed === '[]') {
                    connectedArray = []
                } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                    connectedArray = JSON.parse(trimmed) as string[]
                } else {
                    // Try parsing anyway
                    connectedArray = JSON.parse(trimmed) as string[]
                }
            } else {
                connectedArray = []
            }
        } catch (parseError) {
            console.error("Failed to parse connected array:", { roomId, connected, connectedType: typeof connected, error: parseError })
            // If parsing fails, treat as empty array (might be a new room)
            connectedArray = []
        }
        
        // If token is not in array but room has space, add it automatically
        if(!connectedArray.includes(token))
        {
            // Check if room has space (max 10 users)
            if(connectedArray.length >= 10)
            {
                console.error("Auth failed: Room is full", { roomId, token, connectedArray })
                throw new AuthError("Room is full")
            }
            
            // Add token to connected array
            console.log("Adding token to connected array", { roomId, token, currentArray: connectedArray })
            connectedArray.push(token)
            await redis.hset(`meta:${roomId}`, {
                connected: JSON.stringify(connectedArray)
            })
        }
        
        console.log("Auth successful:", { roomId })
        return {roomId, token, connected: connectedArray}
    } catch (error) {
        console.error("Auth middleware error:", error)
        throw error
    }
})