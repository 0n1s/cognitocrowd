
"use client";

import { useState, useEffect, useRef } from "react";
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
const MAX_CONTEXT_MESSAGES = 16;
const CHAT_MODEL_STORAGE_KEY = "trainly.chat.selectedModel";
const CHAT_MODEL_MESSAGES_STORAGE_KEY = "trainly.chat.messagesByModel";

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
            const history = messages
                .slice(-MAX_CONTEXT_MESSAGES)
                .map((message) => ({
                    role: message.sender === "user" ? "user" as const : "assistant" as const,
                    content: message.text,
                }));
            const result = await aiAssistantTaskGuidance({
                query: currentInput,
                chatModel: selectedChatModel,
                history,
            });
            const aiResponse = result.response;
            
            const logResult = await logChatInteraction(user.uid, chatId, currentInput, aiResponse);
            if (logResult.success && logResult.newChatId) {
                setChatId(logResult.newChatId);
            }

            const aiMessage: Message = { id: (Date.now() + 1).toString(), text: aiResponse, sender: "ai" };
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

    // Track visual viewport height for mobile keyboard handling
    const fullViewportHeightRef = useRef(
        typeof window !== 'undefined' ? (window.visualViewport?.height || window.innerHeight) : 0
    );
    const viewportWidthRef = useRef(
        typeof window !== 'undefined' ? (window.visualViewport?.width || window.innerWidth) : 0
    );
    const [viewportMetrics, setViewportMetrics] = useState<{
        height: number;
        offsetTop: number;
    } | null>(null);

    useEffect(() => {
        const handler = () => {
            const viewport = window.visualViewport;
            const vh = viewport?.height || window.innerHeight;
            const vw = viewport?.width || window.innerWidth;
            const orientationChanged = Math.abs(vw - viewportWidthRef.current) > 50;

            if (orientationChanged) {
                fullViewportHeightRef.current = vh;
            } else if (vh >= fullViewportHeightRef.current * 0.8) {
                // Only refresh the baseline while the keyboard is closed.
                fullViewportHeightRef.current = Math.max(fullViewportHeightRef.current, vh);
            }

            viewportWidthRef.current = vw;
            setViewportMetrics({
                height: vh,
                offsetTop: viewport?.offsetTop || 0,
            });
        };
        handler(); // Set initial
        window.visualViewport?.addEventListener('resize', handler);
        window.visualViewport?.addEventListener('scroll', handler);
        window.addEventListener('resize', handler);
        return () => {
            window.visualViewport?.removeEventListener('resize', handler);
            window.visualViewport?.removeEventListener('scroll', handler);
            window.removeEventListener('resize', handler);
        };
    }, []);

    // Only use the dynamic mobile height while the keyboard is detected.
    const headerOffsetSm = 56; // 3.5rem
    const isMobileKeyboardOpen = viewportMetrics !== null
        && viewportMetrics.height < fullViewportHeightRef.current * 0.8;

    let containerStyle: React.CSSProperties | undefined;
    if (isMobileKeyboardOpen && viewportMetrics !== null) {
        // The browser may pan the visual viewport when focusing the composer.
        // Only subtract the part of the header that is still inside that viewport.
        const visibleHeaderHeight = Math.max(0, headerOffsetSm - viewportMetrics.offsetTop);
        containerStyle = {
            height: Math.max(0, viewportMetrics.height - visibleHeaderHeight),
            overflow: 'hidden',
        };
    }

    return (
        <div
            className="flex min-h-0 flex-col [height:calc(100dvh-3.5rem)] sm:[height:calc(100dvh-5.5rem)]"
            style={containerStyle}
        >
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
                onClearChats={handleClearChats}
                isClearingHistory={isClearingHistory}
                hasChatHistory={Boolean(chatId) || Object.values(messagesByModel).some((modelMessages) => modelMessages.length > 0)}
            />
        </div>
    );
}
