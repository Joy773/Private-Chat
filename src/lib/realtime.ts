import { z } from "zod";
import {InferRealtimeEvents, Realtime} from "@upstash/realtime";
import {redis} from "@/lib/redis";

const messageSchema = z.object({
    id: z.string(),
    sender: z.string(),
    timeStamp: z.number(),
    text: z.string(),
    token: z.string().optional(),
})

const schema = {
    chat : {
        message: messageSchema,
        destroy: z.object({
            isDestroyed: z.literal(true),
        })
    }, 
}

export type Message = z.infer<typeof messageSchema>

export const realtime = new Realtime({schema, redis})           
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>