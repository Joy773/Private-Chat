"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RealtimeProvider } from "@upstash/realtime/client";

export const Providers = ({children} : {children: React.ReactNode}) => {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30 * 1000, // 30 seconds - data is fresh for 30s
                gcTime: 5 * 60 * 1000, // 5 minutes - cache for 5 minutes
                refetchOnWindowFocus: false, // Don't refetch on window focus
                refetchOnReconnect: true, // Refetch on reconnect
            },
            mutations: {
                retry: 1, // Retry failed mutations once
            }
        }
    }))

    return (
        <RealtimeProvider>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </RealtimeProvider>
    )
}