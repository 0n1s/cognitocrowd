import { aiAssistantTaskGuidance } from "@/ai/flows/ai-assistant-chat";
import { logChatInteraction } from "@/lib/actions";
import { ChatUI } from "./chat-ui";

type HandleChatResult = {
    aiResponse: string;
    newChatId: string;
};

async function handleChat(query: string, userId: string, chatId: string | null): Promise<HandleChatResult> {
    "use server";
    try {
        const result = await aiAssistantTaskGuidance({ query });
        const aiResponse = result.response;

        const logResult = await logChatInteraction(userId, chatId, query, aiResponse);

        if (!logResult.success) {
            console.error("Failed to log chat interaction:", logResult.message);
            // We can still return the AI response to the user even if saving fails
        }
        
        return { 
            aiResponse,
            newChatId: logResult.newChatId
        };
    } catch (error) {
        console.error("Error in AI assistant:", error);
        return {
            aiResponse: "Sorry, I encountered an error. Please try again later.",
            newChatId: chatId || ''
        };
    }
}

export default function ChatPage() {
    return (
        <div className="h-full flex flex-col">
            <div className="mb-4">
                <h1 className="text-3xl font-bold font-headline">AI Assistant</h1>
                <p className="text-muted-foreground mt-1">Ask me anything about available contributions or how to get started.</p>
            </div>
            <ChatUI handleChat={handleChat} />
        </div>
    );
}
