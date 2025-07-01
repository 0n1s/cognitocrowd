"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

type Message = {
    id: string;
    text: string;
    sender: "user" | "ai";
};

type HandleChatResult = {
    aiResponse: string;
    newChatId: string;
};

type ChatUIProps = {
    handleChat: (query: string, userId: string, chatId: string | null) => Promise<HandleChatResult>;
};

export function ChatUI({ handleChat }: ChatUIProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [chatId, setChatId] = useState<string | null>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { user } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input || isLoading || !user) return;

        const userMessage: Message = { id: Date.now().toString(), text: input, sender: "user" };
        setMessages((prev) => [...prev, userMessage]);
        const currentInput = input;
        setInput("");
        setIsLoading(true);

        const { aiResponse, newChatId } = await handleChat(currentInput, user.uid, chatId);
        setChatId(newChatId);
        
        const aiMessage: Message = { id: (Date.now() + 1).toString(), text: aiResponse, sender: "ai" };
        setMessages((prev) => [...prev, aiMessage]);
        setIsLoading(false);
    };

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({
                top: scrollAreaRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, [messages]);


    return (
        <div className="flex flex-col h-[calc(100vh-200px)] bg-card rounded-lg border">
            <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
                <div className="space-y-4">
                    {messages.map((message) => (
                        <div key={message.id} className={cn("flex items-start gap-3", message.sender === "user" ? "justify-end" : "")}>
                            {message.sender === "ai" && (
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback>AI</AvatarFallback>
                                </Avatar>
                            )}
                            <div className={cn("max-w-xs md:max-w-md lg:max-w-2xl rounded-lg px-4 py-2", message.sender === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                <p className="text-sm">{message.text}</p>
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
            </ScrollArea>
            <div className="p-4 border-t bg-background rounded-b-lg">
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your message..."
                        disabled={isLoading}
                    />
                    <Button type="submit" size="icon" disabled={isLoading || !input}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}
