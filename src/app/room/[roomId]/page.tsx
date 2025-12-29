"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { format } from "date-fns";
import { useRealtime } from "@/lib/realtime-client";
function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const Page = () => {

  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;


  const queryClient = useQueryClient()
  const {data: messages} = useQuery({
    queryKey: ["messages", roomId], 
    queryFn: async () => {
      try {
        const response = await client.message.get({
          query: {roomId: roomId}
        })
        type ResponseType = { data?: { messages?: Array<{id: string, sender: string, text: string, timeStamp: number}> } }
        const typedResponse = response as unknown as ResponseType
        if(typedResponse?.data?.messages && Array.isArray(typedResponse.data.messages)) {
          return typedResponse.data.messages
        }
        return []
      } catch {
        return []
      }
    },
    enabled: !!roomId,
    staleTime: 10 * 1000, // Messages are fresh for 10 seconds
  })
  const {username} = useUsername();
  const [copyStatus, setCopyStatus] = useState("COPY");
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch TTL for the room - sync every 5 seconds, countdown client-side
  const {data: initialTtl} = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      try {
        const response = await client.room.ttl.get({
          query: {roomId: roomId}
        })
        type ResponseType = { data?: { ttl?: number } }
        const typedResponse = response as unknown as ResponseType
        if(typedResponse?.data?.ttl !== undefined) {
          return typedResponse.data.ttl
        }
        return null
      } catch {
        return null
      }
    },
    enabled: !!roomId,
    refetchInterval: 5000, // Sync with server every 5 seconds instead of 1
  })

  // Client-side countdown timer
  const [countdownOffset, setCountdownOffset] = useState(0)
  const lastTtlRef = useRef<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if(initialTtl === null || initialTtl === undefined) {
      lastTtlRef.current = null
      if(intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    
    // If TTL is 0 or less, redirect to home
    if(initialTtl <= 0) {
      router.push("/?destroyed=true")
      return
    }

    // Reset offset when TTL changes from server (in interval callback to avoid setState in effect)
    if(lastTtlRef.current !== initialTtl) {
      lastTtlRef.current = initialTtl
    }

    // Clear existing interval
    if(intervalRef.current) clearInterval(intervalRef.current)

    // Countdown timer
    intervalRef.current = setInterval(() => {
      setCountdownOffset((prev) => {
        const currentTtl = lastTtlRef.current
        if(currentTtl === null) return prev
        
        // Reset if TTL changed
        if(currentTtl !== initialTtl) {
          lastTtlRef.current = initialTtl
          return 0
        }
        
        const newOffset = prev + 1
        const currentTime = initialTtl - newOffset
        if(currentTime <= 0) {
          router.push("/?destroyed=true")
          return prev
        }
        return newOffset
      })
    }, 1000)

    return () => {
      if(intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [initialTtl, router])

  // Calculate display time
  const displayTime = initialTtl !== null && initialTtl !== undefined 
    ? Math.max(0, initialTtl - countdownOffset) 
    : null
  const {mutate: sendMessage, isPending} = useMutation({
    mutationFn: async ({text}: {text: string}) => {
      await client.message.post({
        sender: username, 
        text
      }, {
        query: {roomId: roomId}
      })
    },
    onSuccess: () => {
      setInput("");
      inputRef.current?.focus();
      // Invalidate messages query to refetch (realtime will also update it)
      queryClient.invalidateQueries({ queryKey: ["messages", roomId] })
    }
  })

  const {mutate: destroyRoom, isPending: isDestroying} = useMutation({
    mutationFn: async () => {
      await client.room.destroy.delete({}, {
        query: {roomId: roomId}
      })
    },
    onSuccess: () => {
      router.push("/?destroyed=true");
    },
    onError: (error) => {
      console.error("Failed to destroy room:", error);
    }
  })

  // Optimistically update messages when receiving realtime events
  const handleRealtimeData = useCallback((arg: {event: "chat.message" | "chat.destroy", data: {id?: string, sender?: string, text?: string, timeStamp?: number, isDestroyed?: boolean}}) => {
    if(arg.event === "chat.message"){
      // Optimistically add the new message to the cache
      queryClient.setQueryData(
        ["messages", roomId],
        (oldMessages: Array<{id: string, sender: string, text: string, timeStamp: number}> | undefined) => {
          if(!oldMessages) return [arg.data]
          // Check if message already exists (avoid duplicates)
          if(oldMessages.some(msg => msg.id === arg.data.id)) return oldMessages
          return [...oldMessages, arg.data]
        }
      )
    }
    if(arg.event === "chat.destroy"){
      router.push("/?destroyed=true");
    }
  }, [roomId, queryClient, router])

  useRealtime({
    channels:[roomId],
    events: ["chat.message", "chat.destroy"],
    onData: handleRealtimeData
  })

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopyStatus("COPIED!");
    setTimeout(() => {
      setCopyStatus("COPY");
    }, 2000);
  };
  return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden bg-black relative">
      {/* Header */}
      <header className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-zinc-900/50 backdrop-blur-sm border-b border-zinc-800/50 gap-3 sm:gap-0">
        <div>
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              ROOM ID
            </span>
            <div className="flex items-center mt-1 flex-wrap sm:flex-nowrap gap-2 sm:gap-0">
              <span className="font-mono font-bold text-green-500 text-sm truncate sm:truncate-none">
                {roomId}
              </span>
              <button
                className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer border border-zinc-700 whitespace-nowrap"
                style={{
                  marginLeft: "0",
                  padding: "5px",
                  borderRadius: "5px",
                }}
                onClick={copyLink}
              >
                {copyStatus}
              </button>
              <div className="h-8 w-px bg-zinc-800 ml-2.5 hidden sm:block" />
              <span className="text-xs text-zinc-500 uppercase ml-2.5 hidden sm:inline">
                Self-Destruct
              </span>
              <span
                className={`text-sm font-bold gap-2 items-center ml-2.5 ${
                  displayTime !== null && displayTime < 60
                    ? "text-red-500"
                    : "text-amber-500"
                }`}
              >
                {displayTime !== null
                  ? formatTimeRemaining(displayTime)
                  : "--:--"}
              </span>
            </div>
          </div>
        </div>
        <button 
          onClick={() => destroyRoom()}
          disabled={isDestroying}
          className="text-xs bg-zinc-800 hover:bg-red-800 rounded px-3 py-1.5 text-zinc-400 hover:text-white font-bold transition-all group flex gap-2 disabled:opacity-50 items-center whitespace-nowrap self-start sm:self-auto"
        >
          <span className="group-hover:animate-pulse">💣</span>
          <span className="hidden sm:inline">{isDestroying ? "DESTROYING..." : "DESTROY NOW"}</span>
          <span className="sm:hidden">{isDestroying ? "..." : "DESTROY"}</span>
        </button>
      </header>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {(!messages || messages.length === 0) && (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-600 text-sm font-mono">No messages yet, start the conversation!</p>
          </div>
        )}
        {messages && messages.length > 0 && messages.map((msg: {id: string, sender: string, text: string, timeStamp: number}) => (
          <div key={msg.id} className="flex flex-col items-start">
            <div className="max-w-[80%] group">
              <div className="flex items-baseline gap-3 mb-1">
                <span className={`text-xs font-bold ${msg.sender === username ? "text-green-500" : "text-blue-500"}`}>{msg.sender === username ? "YOU" : msg.sender}</span>
                  <span className="text-[10px] text-zinc-600">{format(msg.timeStamp, "HH:mm")}</span>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed break-all">{msg.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
        <div className="flex gap-4">
          <div className="flex-1 relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 animate-pulse">
              {">"}
            </span>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={input}
              onKeyDown={(e) => {
                if(e.key === "Enter" && input.trim() && !isPending){
                    sendMessage({text: input});
                }
              }}
              placeholder="Type your message..."
              onChange = {(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
              className="w-full bg-black border border-zinc-800 focus:border-zinc-700 focus:outline-none transition-color text-zinc-100 placeholder:text-zinc-700 py-3 pl-8 pr-4 text-sm"
            />
          </div>
          <button 
            onClick={() => {
              if(input.trim() && !isPending) {
                sendMessage({text: input});
              }
            }}
            disabled={!input.trim() || isPending}
            className="bg-zinc-800 text-zinc-400 px-6 py-3 text-sm font-bold hover:text-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            SEND
          </button>
        </div>
      </div>
    </main>
  );
};

export default Page;
