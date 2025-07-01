
"use client";

import { useRef, useEffect } from "react";
import type { User } from "firebase/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export type Message = {
    id: string;
    text: string;
    sender: "user" | "ai";
};

type ChatUIProps = {
    messages: Message[];
    input: string;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
    isLoadingHistory: boolean;
    user: User | null;
};

const ChatSkeleton = () => (
    <div className="space-y-4">
        <div className="flex items-start gap-3 justify-end">
            <div className="max-w-xs rounded-lg p-3 bg-muted">
                <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="flex items-start gap-3">
             <Skeleton className="h-8 w-8 rounded-full" />
            <div className="max-w-xs rounded-lg p-3 bg-muted">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-4 w-32 mt-2" />
            </div>
        </div>
         <div className="flex items-start gap-3 justify-end">
            <div className="max-w-xs rounded-lg p-3 bg-muted">
                <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="flex items-start gap-3">
             <Skeleton className="h-8 w-8 rounded-full" />
            <div className="max-w-xs rounded-lg p-3 bg-muted">
                <Skeleton className="h-4 w-44" />
            </div>
        </div>
    </div>
);


export function ChatUI({ messages, input, handleInputChange, handleSubmit, isLoading, isLoadingHistory, user }: ChatUIProps) {
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollAreaRef.current) {
            setTimeout(() => {
                scrollAreaRef.current?.scrollTo({
                    top: scrollAreaRef.current.scrollHeight,
                    behavior: 'smooth',
                });
            }, 100);
        }
    }, [messages]);


    return (
        <div className="flex flex-col h-[calc(100vh-200px)] bg-card rounded-lg border">
            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                {isLoadingHistory ? <ChatSkeleton /> : (
                    <div className="space-y-4">
                        {messages.map((message) => (
                            <div key={message.id} className={cn("flex items-start gap-3", message.sender === "user" ? "justify-end" : "")}>
                                {message.sender === "ai" && (
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback>AI</AvatarFallback>
                                    </Avatar>
                                )}
                                <div className={cn("max-w-xs md:max-w-md lg:max-w-2xl rounded-lg px-4 py-2", message.sender === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                                </div>
                                {message.sender === "user" && (
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                                    </Avatar>
                                )}
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-start gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback>AI</AvatarFallback>
                                </Avatar>
                                <div className="max-w-xs md:max-w-md lg:max-w-2xl rounded-lg px-4 py-2 bg-muted flex items-center">
                                    <span className="w-2 h-2 bg-foreground rounded-full animate-pulse delay-0"></span>
                                    <span className="w-2 h-2 bg-foreground rounded-full animate-pulse delay-150 mx-1"></span>
                                    <span className="w-2 h-2 bg-foreground rounded-full animate-pulse delay-300"></span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>
            <div className="p-4 border-t bg-background rounded-b-lg">
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <Input
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Type your message..."
                        disabled={isLoading || isLoadingHistory}
                    />
                    <Button type="submit" size="icon" disabled={isLoading || isLoadingHistory || !input}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}
