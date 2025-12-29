import { NextRequest, NextResponse } from "next/server";
import { redis } from "./lib/redis";
import { nanoid } from "nanoid";
export const proxy = async (req: NextRequest) => {
    const pathname = req.nextUrl.pathname;

    const roomMatch = pathname.match(/^\/room\/([^/]+)$/);

    if(!roomMatch) 
        {
            return NextResponse.redirect(new URL("/", req.url));
        }

        const roomId = roomMatch[1];

        const meta = await redis.hgetall(`meta:${roomId}`)
        if(!meta || !meta.connected)
            {
                return NextResponse.redirect(new URL("/?error=room_not_found", req.url));
            }

            // Parse connected array from Redis
            const connectedStr = meta.connected as string
            let connectedArray: string[] = []
            try {
                if (connectedStr && connectedStr.trim() !== '') {
                    connectedArray = JSON.parse(connectedStr) as string[]
                }
            } catch {
                connectedArray = []
            }

            const existingToken = req.cookies.get("x-auth-token")?.value

            //User is allowed to join the room
            if(existingToken && connectedArray.includes(existingToken))
                {
                    return NextResponse.next();
                }

                //User is not allowed to join the room (max 10 members)
                if(connectedArray.length >= 10)
                    {
                        return NextResponse.redirect(new URL("/?error=room_full", req.url));
                    }

            const response = NextResponse.next();

            const token = existingToken || nanoid()

            response.cookies.set("x-auth-token", token, {
                path: "/",
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
            })
            
            // Update the room's connected array with the new token
            const updatedConnected = [...connectedArray, token]
            await redis.hset(`meta:${roomId}`, {
                connected: JSON.stringify(updatedConnected)
            })
            return response;
}

export const config = {
    matcher: "/room/:path*"
}   