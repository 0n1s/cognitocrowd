import { aiAssistantTaskGuidance } from "@/ai/flows/ai-assistant-chat";
import { ChatUI } from "./chat-ui";

async function handleChat(query: string) {
    "use server";
    try {
        const result = await aiAssistantTaskGuidance({ query });
        return result.response;
    } catch (error) {
        console.error("Error in AI assistant:", error);
        return "Sorry, I encountered an error. Please try again later.";
    }
}

export default function ChatPage() {
    return (
        <div className="h-full flex flex-col">
            <div className="mb-4">
                <h1 className="text-3xl font-bold font-headline">AI Assistant</h1>
                <p className="text-muted-foreground mt-1">Ask me anything about available tasks or how to get started.</p>
            </div>
            <ChatUI handleChat={handleChat} />
        </div>
    );
}
