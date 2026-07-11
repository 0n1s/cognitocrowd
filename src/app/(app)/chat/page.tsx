
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { ChatUI, type Message } from "./chat-ui";
import { aiAssistantTaskGuidance } from "@/ai/flows/ai-assistant-chat";
import { clearUserChats, logChatInteraction, getInitialChatHistory } from "@/lib/user-api";
import { getPackage, getUserData } from "@/lib/database";
import type { Package } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

type ChatSessionPayload = {
    id: string;
    messages?: Array<{ id: string; text: string; sender: "user" | "ai" }>;
};

type ChatModelKey = "normal" | "uncensored" | "coding" | "hacking";
const CHAT_MODEL_STORAGE_KEY = "trainly.chat.selectedModel";
const CHAT_MODEL_MESSAGES_STORAGE_KEY = "trainly.chat.messagesByModel";
const CHAT_SHOW_REASONING_STORAGE_KEY = "trainly.chat.showReasoning";

function getAllowedChatModels(userPackage: Package | null): ChatModelKey[] {
    const legacyTypes = userPackage?.allowedModelTypes || [];
    const hasLegacyType = (type: string) => legacyTypes.includes(type);
    const legacyFallbackEnabled = legacyTypes.length === 0;

    const allowChatNormal = (userPackage?.allowChatNormal ?? hasLegacyType("text")) || legacyFallbackEnabled;
    const allowChatUncensored = userPackage?.allowChatUncensored ?? hasLegacyType("uncensored");
    const allowChatCoding = userPackage?.allowChatCoding ?? hasLegacyType("coding");
    const allowChatHacking = userPackage?.allowChatHacking ?? hasLegacyType("hacking");

    const allowed: ChatModelKey[] = [];
    if (allowChatNormal) allowed.push("normal");
    if (allowChatUncensored) allowed.push("uncensored");
    if (allowChatCoding) allowed.push("coding");
    if (allowChatHacking) allowed.push("hacking");
    return allowed;
}

export default function ChatPage() {
    const [messagesByModel, setMessagesByModel] = useState<Record<ChatModelKey, Message[]>>({
        normal: [],
        uncensored: [],
        coding: [],
        hacking: [],
    });
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [isClearingHistory, setIsClearingHistory] = useState(false);
    const [chatId, setChatId] = useState<string | null>(null);
    const [allowedChatModels, setAllowedChatModels] = useState<ChatModelKey[]>(["normal"]);
    const [selectedChatModel, setSelectedChatModel] = useState<ChatModelKey>("normal");
    const [showReasoningSummary, setShowReasoningSummary] = useState(false);
    const { user } = useAuth();
    const { toast } = useToast();

    const messages = messagesByModel[selectedChatModel] || [];

    const persistChatModel = (value: ChatModelKey) => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(CHAT_MODEL_STORAGE_KEY, value);
    };

    const persistMessagesByModel = (next: Record<ChatModelKey, Message[]>) => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(CHAT_MODEL_MESSAGES_STORAGE_KEY, JSON.stringify(next));
    };

    const persistShowReasoning = (next: boolean) => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(CHAT_SHOW_REASONING_STORAGE_KEY, next ? "1" : "0");
    };

    const readPersistedChatModel = (): ChatModelKey | null => {
        if (typeof window === "undefined") return null;
        const stored = window.localStorage.getItem(CHAT_MODEL_STORAGE_KEY);
        if (stored === "normal" || stored === "uncensored" || stored === "coding" || stored === "hacking") {
            return stored;
        }
        return null;
    };

    const readPersistedMessagesByModel = (): Record<ChatModelKey, Message[]> | null => {
        if (typeof window === "undefined") return null;
        const raw = window.localStorage.getItem(CHAT_MODEL_MESSAGES_STORAGE_KEY);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as Partial<Record<ChatModelKey, Message[]>>;
            return {
                normal: Array.isArray(parsed.normal) ? parsed.normal : [],
                uncensored: Array.isArray(parsed.uncensored) ? parsed.uncensored : [],
                coding: Array.isArray(parsed.coding) ? parsed.coding : [],
                hacking: Array.isArray(parsed.hacking) ? parsed.hacking : [],
            };
        } catch {
            return null;
        }
    };

    const readPersistedShowReasoning = () => {
        if (typeof window === "undefined") return false;
        return window.localStorage.getItem(CHAT_SHOW_REASONING_STORAGE_KEY) === "1";
    };
    
    useEffect(() => {
        async function fetchHistoryAndPackage() {
            if (!user) return;
            
            setIsLoadingHistory(true);
            const [result, userData] = await Promise.all([
                getInitialChatHistory(user.uid),
                getUserData(user.uid),
            ]);
            const session = (result.success ? result.session : null) as ChatSessionPayload | null;

            let pkg: Package | null = null;
            if (userData?.packageId) {
                pkg = await getPackage(userData.packageId);
            }

            const allowedModels = getAllowedChatModels(pkg);
            setAllowedChatModels(allowedModels);
            const persistedMessages = readPersistedMessagesByModel();
            if (persistedMessages) {
                setMessagesByModel(persistedMessages);
            }

            const persistedReasoningToggle = readPersistedShowReasoning();
            setShowReasoningSummary(persistedReasoningToggle);

            const persistedModel = readPersistedChatModel();
            const nextModel = persistedModel && allowedModels.includes(persistedModel)
                ? persistedModel
                : (allowedModels[0] || "normal");
            setSelectedChatModel(nextModel);
            persistChatModel(nextModel);
            
            if (session && session.messages) {
                // Ensure messages are properly formed before setting state
                const formattedMessages = session.messages.map(m => ({
                    id: m.id,
                    text: m.text,
                    sender: m.sender
                }));
                setMessagesByModel((prev) => {
                    const next = {
                        ...prev,
                        [nextModel]: formattedMessages,
                    };
                    persistMessagesByModel(next);
                    return next;
                });
                setChatId(session.id);
            }
            setIsLoadingHistory(false);
        }
        fetchHistoryAndPackage();
    }, [user]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || isLoadingHistory || !user || allowedChatModels.length === 0) return;

        const userMessage: Message = { id: Date.now().toString(), text: input, sender: "user" };
        setMessagesByModel((prev) => {
            const next = {
                ...prev,
                [selectedChatModel]: [...(prev[selectedChatModel] || []), userMessage],
            };
            persistMessagesByModel(next);
            return next;
        });
        const currentInput = input;
        setInput("");
        setIsLoading(true);

        try {
            const result = await aiAssistantTaskGuidance({ query: currentInput, chatModel: selectedChatModel });
            const aiResponse = result.response;
            const reasoningSummary = result.reasoningSummary;
            const combinedText = showReasoningSummary && reasoningSummary
                ? `${aiResponse}\n\nReasoning summary: ${reasoningSummary}`
                : aiResponse;
            
            const logResult = await logChatInteraction(user.uid, chatId, currentInput, combinedText);
            if (logResult.success && logResult.newChatId) {
                setChatId(logResult.newChatId);
            }

            const aiMessage: Message = { id: (Date.now() + 1).toString(), text: combinedText, sender: "ai" };
            setMessagesByModel((prev) => {
                const next = {
                    ...prev,
                    [selectedChatModel]: [...(prev[selectedChatModel] || []), aiMessage],
                };
                persistMessagesByModel(next);
                return next;
            });

        } catch (error) {
             console.error("Error in AI assistant:", error);
             const errorMessage: Message = { 
                 id: (Date.now() + 1).toString(), 
                 text: "Sorry, I encountered an error. Please try again later.", 
                 sender: "ai" 
             };
             setMessagesByModel((prev) => {
                const next = {
                    ...prev,
                    [selectedChatModel]: [...(prev[selectedChatModel] || []), errorMessage],
                };
                persistMessagesByModel(next);
                return next;
             });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearChats = async () => {
        if (!user || isClearingHistory) return;
        setIsClearingHistory(true);
        try {
            const result = await clearUserChats(user.uid);
            if (!result.success) throw new Error(result.message || 'Could not clear chat history.');

            const emptyMessages: Record<ChatModelKey, Message[]> = {
                normal: [],
                uncensored: [],
                coding: [],
                hacking: [],
            };
            setMessagesByModel(emptyMessages);
            persistMessagesByModel(emptyMessages);
            setChatId(null);
            setInput('');
            toast({ title: 'Chat history cleared' });
        } catch (error) {
            toast({
                title: 'Could not clear chats',
                description: error instanceof Error ? error.message : 'Unknown error.',
                variant: 'destructive',
            });
        } finally {
            setIsClearingHistory(false);
        }
    };

    return (
        <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col sm:h-[calc(100dvh-5.5rem)]">
            <div className="hidden mb-3 sm:block">
                <h1 className="text-2xl font-bold font-headline lg:text-3xl">TrainlyLabs AI Assistant</h1>
                <p className="mt-1 text-sm text-muted-foreground">Ask me anything about available contributions or how to get started.</p>
            </div>
            <ChatUI 
                messages={messages}
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                isLoading={isLoading}
                isLoadingHistory={isLoadingHistory}
                user={user}
                allowedChatModels={allowedChatModels}
                selectedChatModel={selectedChatModel}
                onChatModelChange={(value) => {
                    setSelectedChatModel(value);
                    persistChatModel(value);
                }}
                showReasoningSummary={showReasoningSummary}
                onShowReasoningSummaryChange={(next) => {
                    setShowReasoningSummary(next);
                    persistShowReasoning(next);
                }}
                onClearChats={handleClearChats}
                isClearingHistory={isClearingHistory}
                hasChatHistory={Boolean(chatId) || Object.values(messagesByModel).some((modelMessages) => modelMessages.length > 0)}
            />
        </div>
    );
}
