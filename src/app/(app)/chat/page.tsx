
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ChatUI, type Message } from "./chat-ui";
import { aiAssistantTaskGuidance } from "@/ai/flows/ai-assistant-chat";
import { logChatInteraction, getInitialChatHistory } from "@/lib/actions";

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [chatId, setChatId] = useState<string | null>(null);
    const { user } = useAuth();
    
    useEffect(() => {
        async function fetchHistory() {
            if (!user) return;
            
            setIsLoadingHistory(true);
            const session = await getInitialChatHistory(user.uid);
            
            if (session && session.messages) {
                // Ensure messages are properly formed before setting state
                const formattedMessages = session.messages.map(m => ({
                    id: m.id,
                    text: m.text,
                    sender: m.sender
                }));
                setMessages(formattedMessages);
                setChatId(session.id);
            }
            setIsLoadingHistory(false);
        }
        fetchHistory();
    }, [user]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || isLoadingHistory || !user) return;

        const userMessage: Message = { id: Date.now().toString(), text: input, sender: "user" };
        setMessages((prev) => [...prev, userMessage]);
        const currentInput = input;
        setInput("");
        setIsLoading(true);

        try {
            const result = await aiAssistantTaskGuidance({ query: currentInput });
            const aiResponse = result.response;
            
            const logResult = await logChatInteraction(user.uid, chatId, currentInput, aiResponse);
            if (logResult.success && logResult.newChatId) {
                setChatId(logResult.newChatId);
            }

            const aiMessage: Message = { id: (Date.now() + 1).toString(), text: aiResponse, sender: "ai" };
            setMessages((prev) => [...prev, aiMessage]);

        } catch (error) {
             console.error("Error in AI assistant:", error);
             const errorMessage: Message = { 
                 id: (Date.now() + 1).toString(), 
                 text: "Sorry, I encountered an error. Please try again later.", 
                 sender: "ai" 
             };
             setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="mb-4">
                <h1 className="text-3xl font-bold font-headline">Trainly AI Assistant</h1>
                <p className="text-muted-foreground mt-1">Ask me anything about available contributions or how to get started.</p>
            </div>
            <ChatUI 
                messages={messages}
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                isLoading={isLoading}
                isLoadingHistory={isLoadingHistory}
                user={user}
            />
        </div>
    );
}
