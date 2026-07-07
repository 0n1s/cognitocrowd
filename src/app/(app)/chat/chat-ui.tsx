
"use client";

import { useRef, useEffect } from "react";
import type { User } from "firebase/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Sparkles, Flame, Code2, TerminalSquare, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ChatModelKey = "normal" | "uncensored" | "coding" | "hacking";

const ALL_CHAT_MODELS: ChatModelKey[] = ["normal", "uncensored", "coding", "hacking"];

const CHAT_MODEL_LABELS: Record<ChatModelKey, string> = {
    normal: "Normal",
    uncensored: "Uncensored",
    coding: "Coding",
    hacking: "Hacking",
};

const CHAT_MODEL_ACCENTS: Record<ChatModelKey, string> = {
    normal: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    uncensored: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    coding: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    hacking: "bg-lime-500/15 text-lime-700 dark:text-lime-300",
};

const CHAT_THEME = {
    normal: {
        shell: "border-sky-200/70 dark:border-sky-900/60",
        header: "from-sky-500/12 via-sky-400/6 to-cyan-500/10",
        surface: "from-background via-background to-sky-500/5",
        userBubble: "bg-sky-600 text-white",
        sendButton: "bg-sky-600 hover:bg-sky-700 text-white",
    },
    uncensored: {
        shell: "border-rose-200/70 dark:border-rose-900/60",
        header: "from-rose-500/12 via-pink-500/8 to-red-500/10",
        surface: "from-background via-background to-rose-500/5",
        userBubble: "bg-rose-600 text-white",
        sendButton: "bg-rose-600 hover:bg-rose-700 text-white",
    },
    coding: {
        shell: "border-emerald-200/70 dark:border-emerald-900/60",
        header: "from-emerald-500/12 via-green-500/8 to-teal-500/10",
        surface: "from-background via-background to-emerald-500/5",
        userBubble: "bg-emerald-600 text-white",
        sendButton: "bg-emerald-600 hover:bg-emerald-700 text-white",
    },
    hacking: {
        shell: "border-lime-500/40 bg-black text-lime-200 shadow-[0_0_0_1px_rgba(132,204,22,0.25),0_0_28px_rgba(132,204,22,0.08)]",
        header: "from-lime-500/15 via-emerald-500/10 to-black",
        surface: "from-black via-zinc-950 to-black",
        userBubble: "bg-lime-500/20 text-lime-100 border border-lime-500/35",
        sendButton: "bg-lime-500 text-black hover:bg-lime-400",
    },
} satisfies Record<ChatModelKey, {
    shell: string;
    header: string;
    surface: string;
    userBubble: string;
    sendButton: string;
}>;

const CHAT_MODE_PERSONA = {
    normal: {
        title: "Creative Co-Pilot",
        subtitle: "Balanced and helpful guidance for day-to-day contributor flow.",
        icon: Sparkles,
        iconClass: "text-sky-500",
        aiBubble: "border-sky-200/70 bg-white/80 dark:bg-sky-950/30 dark:border-sky-900/60",
        inputPlaceholder: "Ask for quick strategy, task tips, or onboarding help...",
    },
    uncensored: {
        title: "Raw Mode",
        subtitle: "Direct, unfiltered tone with blunt clarity.",
        icon: Flame,
        iconClass: "text-rose-500",
        aiBubble: "border-rose-300/70 bg-rose-50/70 dark:bg-rose-950/30 dark:border-rose-900/70",
        inputPlaceholder: "Ask directly. This mode keeps responses candid.",
    },
    coding: {
        title: "Dev Console",
        subtitle: "Code-first assistant focused on implementation details.",
        icon: Code2,
        iconClass: "text-emerald-500",
        aiBubble: "border-emerald-300/70 bg-emerald-50/70 dark:bg-emerald-950/25 dark:border-emerald-900/70 font-mono",
        inputPlaceholder: "Describe a bug, API flow, or architecture task...",
    },
    hacking: {
        title: "Offensive Simulator",
        subtitle: "Security-oriented thinking in a controlled, defensive shell.",
        icon: TerminalSquare,
        iconClass: "text-lime-400",
        aiBubble: "border-lime-500/30 bg-zinc-950/95 text-lime-200",
        inputPlaceholder: "Run a threat-analysis prompt in this shell...",
    },
} satisfies Record<ChatModelKey, {
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    aiBubble: string;
    inputPlaceholder: string;
}>;

export type Message = {
    id: string;
    text: string;
    sender: "user" | "ai";
};

type ChatUIProps = {
    messages: Message[];
    input: string;
    handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    handleSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
    isLoadingHistory: boolean;
    user: User | null;
    allowedChatModels: ChatModelKey[];
    selectedChatModel: ChatModelKey;
    onChatModelChange: (value: ChatModelKey) => void;
    showReasoningSummary: boolean;
    onShowReasoningSummaryChange: (next: boolean) => void;
    onClearChats: () => Promise<void>;
    isClearingHistory: boolean;
    hasChatHistory: boolean;
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


export function ChatUI({
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    isLoadingHistory,
    user,
    allowedChatModels,
    selectedChatModel,
    onChatModelChange,
    showReasoningSummary,
    onShowReasoningSummaryChange,
    onClearChats,
    isClearingHistory,
    hasChatHistory,
}: ChatUIProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const canChat = allowedChatModels.length > 0;
    const selectedModelLabel = CHAT_MODEL_LABELS[selectedChatModel];
    const theme = CHAT_THEME[selectedChatModel];
    const persona = CHAT_MODE_PERSONA[selectedChatModel];
    const PersonaIcon = persona.icon;
    const isHacking = selectedChatModel === "hacking";

    useEffect(() => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
    }, [messages, isLoading]);

    useEffect(() => {
        if (!input && inputRef.current) inputRef.current.style.height = '44px';
    }, [input]);


    return (
        <div className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden border-y bg-card shadow-sm sm:rounded-2xl sm:border", theme.shell, isHacking && "font-mono") }>
            <div className={cn("shrink-0 border-b bg-gradient-to-r px-3 py-2.5 sm:px-4 sm:py-3 md:px-5", theme.header)}>
                <div className="flex items-center gap-2 sm:flex-col sm:items-stretch sm:gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 space-y-1">
                        <p className={cn("flex items-center gap-2 truncate text-sm font-semibold text-foreground", isHacking && "tracking-wide text-lime-300")}>
                            <PersonaIcon className={cn("h-4 w-4", persona.iconClass)} />
                            {isHacking ? "root@trainly:~# chat-session" : persona.title}
                        </p>
                        <p className={cn("hidden text-xs text-muted-foreground sm:block", isHacking && "text-lime-300/75")}>{persona.subtitle}</p>
                        <p className="hidden text-xs text-muted-foreground sm:block">Model: <span className={cn("rounded-full px-2 py-0.5 font-semibold", CHAT_MODEL_ACCENTS[selectedChatModel])}>{selectedModelLabel}</span></p>
                    </div>
                    <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:ml-0">
                        <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Chat Model</span>
                        <Select value={selectedChatModel} onValueChange={(value) => onChatModelChange(value as ChatModelKey)} disabled={isLoading || isLoadingHistory || !canChat}>
                            <SelectTrigger className="h-8 w-[112px] text-xs min-[390px]:w-[132px] sm:w-[220px]">
                                <SelectValue placeholder="Select chat model" />
                            </SelectTrigger>
                            <SelectContent>
                                {allowedChatModels.map((model) => (
                                    <SelectItem key={model} value={model}>{CHAT_MODEL_LABELS[model]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                    disabled={isLoading || isLoadingHistory || isClearingHistory || !hasChatHistory}
                                    aria-label="Clear chat history"
                                    title="Clear chat history"
                                >
                                    {isClearingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Clear all chat history?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This permanently deletes your saved conversations across every chat mode. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => void onClearChats()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Clear chats
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
                <div className="mt-2 hidden flex-wrap items-center gap-2 sm:flex">
                    {allowedChatModels.map((model) => (
                        <button
                            key={`tab-${model}`}
                            type="button"
                            onClick={() => onChatModelChange(model)}
                            className={cn(
                                "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                                selectedChatModel === model
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-background/70 text-foreground hover:bg-background"
                            )}
                        >
                            {CHAT_MODEL_LABELS[model]}
                        </button>
                    ))}
                    <div className="ml-auto flex items-center gap-2 rounded-full border border-border bg-background/70 px-2.5 py-1">
                        <span className="text-[11px] text-muted-foreground">Show reasoning summary</span>
                        <Switch checked={showReasoningSummary} onCheckedChange={onShowReasoningSummaryChange} />
                    </div>
                </div>
                <div className="mt-1.5 flex items-center justify-end gap-2 sm:hidden">
                    <span className="text-[10px] text-muted-foreground">Reasoning summary</span>
                    <Switch checked={showReasoningSummary} onCheckedChange={onShowReasoningSummaryChange} />
                </div>
                <div className="mt-2 hidden flex-wrap gap-1.5 md:flex">
                    {ALL_CHAT_MODELS.map((model) => {
                        const isAllowed = allowedChatModels.includes(model);
                        const isSelected = selectedChatModel === model;
                        return (
                            <span
                                key={model}
                                className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                                    isAllowed
                                        ? CHAT_MODEL_ACCENTS[model]
                                        : "border-border bg-muted text-muted-foreground",
                                    isSelected && "ring-1 ring-primary/40"
                                )}
                            >
                                <span>{CHAT_MODEL_LABELS[model]}</span>
                                <span className="text-[10px] opacity-80">{isAllowed ? "Allowed" : "Locked"}</span>
                            </span>
                        );
                    })}
                </div>
            </div>

            <div className={cn("relative min-h-0 flex-1 bg-gradient-to-b", theme.surface)}>
                {isHacking && (
                    <>
                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(132,204,22,0.06)_1px,transparent_1px)] bg-[size:100%_3px] opacity-35" />
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(132,204,22,0.12),transparent_55%)]" />
                    </>
                )}
                <ScrollArea className="h-full overscroll-contain">
                    {isLoadingHistory ? <div className="px-3 py-4"><ChatSkeleton /></div> : (
                        <div className="space-y-3 px-2.5 py-3 pb-2 sm:space-y-4 sm:px-4 sm:py-4 md:px-6">
                            {messages.length === 0 && !isLoading && (
                                <div className={cn("mx-auto mt-4 max-w-xl rounded-xl border border-dashed bg-muted/40 p-4 text-center sm:mt-10 sm:p-6", isHacking && "border-lime-500/40 bg-lime-500/5 text-lime-200") }>
                                    <p className="text-sm font-semibold">{isHacking ? "Initialize terminal query" : "Start your first message"}</p>
                                    <p className={cn("mt-1 text-sm text-muted-foreground", isHacking && "text-lime-300/80")}>{isHacking ? "Probe tasks, points, workflow paths, and system behavior from this shell." : "Ask about tasks, points, workflow tips, or anything related to your contributor dashboard."}</p>
                                </div>
                            )}

                            {messages.map((message) => (
                                <div key={message.id} className={cn("flex items-end gap-1.5 sm:gap-3", message.sender === "user" ? "justify-end" : "")}> 
                                    {message.sender === "ai" && (
                                        <Avatar className="hidden h-8 w-8 border bg-background sm:flex">
                                            <AvatarFallback>AI</AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div
                                        className={cn(
                                            "max-w-[94%] overflow-hidden rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[88%] sm:px-4 sm:py-2.5 md:max-w-[72%]",
                                            message.sender === "user"
                                                ? cn("rounded-br-md", theme.userBubble)
                                                : cn("border bg-card rounded-bl-md", persona.aiBubble)
                                        )}
                                    >
                                        <p className="break-words whitespace-pre-wrap leading-relaxed">{message.text}</p>
                                    </div>
                                    {message.sender === "user" && (
                                        <Avatar className="hidden h-8 w-8 border bg-background sm:flex">
                                            <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                                        </Avatar>
                                    )}
                                </div>
                            ))}

                            {isLoading && (
                                <div className="flex items-end gap-1.5 sm:gap-3">
                                    <Avatar className="hidden h-8 w-8 border bg-background sm:flex">
                                        <AvatarFallback>AI</AvatarFallback>
                                    </Avatar>
                                    <div className="flex max-w-xs items-center rounded-2xl rounded-bl-md border bg-card px-4 py-3">
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-foreground/80"></span>
                                        <span className="mx-1 h-2 w-2 animate-pulse rounded-full bg-foreground/70 delay-150"></span>
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-foreground/60 delay-300"></span>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </ScrollArea>
            </div>

            <div className={cn("shrink-0 border-t bg-background/95 px-2.5 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur sm:p-3 md:p-4", isHacking && "border-lime-500/35 bg-black/95") }>
                <form ref={formRef} onSubmit={handleSubmit} className="flex items-end gap-2">
                    {isHacking && <span className="hidden text-sm text-lime-400 md:inline">$</span>}
                    <Textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        onInput={(event) => {
                            const target = event.currentTarget;
                            target.style.height = '44px';
                            target.style.height = `${Math.min(target.scrollHeight, 112)}px`;
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                event.preventDefault();
                                formRef.current?.requestSubmit();
                            }
                        }}
                        placeholder={canChat ? persona.inputPlaceholder : "No chat models are enabled in your package."}
                        disabled={isLoading || isLoadingHistory || !canChat}
                        rows={1}
                        className={cn("max-h-28 !min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl py-2.5 text-base sm:text-sm", isHacking && "border-lime-500/40 bg-zinc-950 text-lime-100 placeholder:text-lime-400/50 focus-visible:ring-lime-500")}
                    />
                    <Button type="submit" size="icon" className={cn("h-11 w-11 shrink-0 rounded-xl", theme.sendButton)} disabled={isLoading || isLoadingHistory || !input.trim() || !canChat}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
                {!canChat && (
                    <p className="mt-2 text-xs text-muted-foreground">Your current package does not allow any chat models.</p>
                )}
            </div>
        </div>
    );
}
