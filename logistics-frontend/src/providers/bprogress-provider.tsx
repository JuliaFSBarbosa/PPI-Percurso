"use client";

import { ProgressProvider } from "@bprogress/next/app";

export const BProgressProvider = ({ children }: { children: React.ReactNode }) => {
    return <ProgressProvider height="4px" color="#1c6bfd">{children}</ProgressProvider>
}