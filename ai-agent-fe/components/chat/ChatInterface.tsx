'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SendHorizontal } from 'lucide-react';
import { 
  RawMessage, 
  DisplayMessage, 
  ChatInterfaceProps, 
  AssistantApiResponse 
} from '@/lib/types/ui';

// Simple message display component
const MessageBubble: React.FC<{ message: DisplayMessage, onNextActionClick: (action: string) => void }> = ({ message, onNextActionClick }) => {
    const sender = message.sender || 'system';
    const text = message.text || '';
    const nextActions = message.next_actions || [];

    return (
        <div className={`flex flex-col ${sender === 'user' ? 'items-end' : 'items-start'} mb-2`}>
            <div
                className={`max-w-[70%] rounded-lg px-3 py-2 mb-1 ${sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                    }`}
            >
                {text}
            </div>
            {sender === 'assistant' && nextActions.length > 0 && (
                <div className="flex flex-wrap gap-2 max-w-[70%] justify-start mt-1">
                    {nextActions.map((action, index) => (
                        <Button
                            key={`${message.messageId}-action-${index}`}
                            variant="outline"
                            size="sm"
                            onClick={() => onNextActionClick(action)}
                            className="text-xs h-auto py-1 px-2"
                        >
                            {action}
                        </Button>
                    ))}
                </div>
            )}
        </div>
    );
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ sessionId: initialSessionId, initialMessages = [] }) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<DisplayMessage[]>(initialMessages);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingMessages, setIsFetchingMessages] = useState(false);
    const currentSessionId = initialSessionId; // Use prop directly
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Function to scroll to bottom
    const scrollToBottom = useCallback(() => {
        if (scrollAreaRef.current) {
            const scrollViewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
            if (scrollViewport) {
                scrollViewport.scrollTop = scrollViewport.scrollHeight;
            }
        }
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Fetch session messages on component mount or when session ID changes
    useEffect(() => {
        const fetchMessages = async () => {
            if (!user || !currentSessionId) return;

            try {
                setIsFetchingMessages(true);
                const idToken = await user.getIdToken();

                const response = await fetch(`/api/sessions/${currentSessionId}`, {
                    headers: {
                        'Authorization': `Bearer ${idToken}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    // Use the RawMessage type here, requires conversion logic
                    const fetchedMessages: RawMessage[] = data.messages || []; 
                    const formattedMessages: DisplayMessage[] = fetchedMessages.map((msg: RawMessage) => {
                        let createdAtDate: Date | null = null;
                        // Handle conversion from string or Timestamp-like object if needed
                        if (msg.createdAt) {
                            if (typeof msg.createdAt === 'string') {
                                createdAtDate = new Date(msg.createdAt);
                            // Add check for Firestore Timestamp-like object if necessary
                            } else if (typeof msg.createdAt === 'object' && msg.createdAt !== null && 'toDate' in msg.createdAt && typeof msg.createdAt.toDate === 'function') {
                                // Attempt to convert if it looks like a Firestore Timestamp passed as JSON
                                try {
                                    createdAtDate = msg.createdAt.toDate();
                                } catch (e) {
                                    console.error("Error converting Firestore-like timestamp:", e);
                                    createdAtDate = null;
                                }
                            } else {
                                console.warn("Unrecognized createdAt format:", msg.createdAt);
                            }
                        }
                        return {
                            ...msg,
                            createdAt: createdAtDate,
                            next_actions: msg.next_actions || [], 
                        };
                    });
                    setMessages(formattedMessages);
                } else {
                    const errorData = await response.json();
                    console.error("Error fetching session messages:", errorData.error);
                     setMessages([{ messageId: `fetch-error-${Date.now()}`, sender: 'system', text: `Error loading messages: ${errorData.error || 'Unknown error'}`, createdAt: new Date(), role: 'system' }]);
                }
            } catch (error) {
                console.error("Error fetching session messages:", error);
                setMessages([{ messageId: `fetch-error-${Date.now()}`, sender: 'system', text: `Error loading messages: ${error instanceof Error ? error.message : 'Network error'}`, createdAt: new Date(), role: 'system' }]);
            } finally {
                setIsFetchingMessages(false);
            }
        };

        fetchMessages();
    }, [user, currentSessionId]); // Depend on currentSessionId

    // Reverted function to send message via the sessions/messages endpoint
    const sendMessageToServer = useCallback(async (messageText: string) => {
        if (!messageText.trim() || isLoading || !user) return;

        const optimisticUserMessage: DisplayMessage = {
            messageId: `temp-user-${Date.now()}`,
            sender: 'user',
            text: messageText,
            createdAt: new Date(),
            role: 'user',
        };

        setMessages((prev) => [...prev, optimisticUserMessage]);
        setInput('');
        setIsLoading(true);
        scrollToBottom();

        // Add a "Thinking..." message placeholder for assistant
        const thinkingMessageId = `thinking-${Date.now()}`;
        const thinkingPlaceholder: DisplayMessage = {
            messageId: thinkingMessageId,
            sender: 'assistant',
            text: 'Thinking...',
            createdAt: new Date(),
            role: 'assistant',
        };
        setMessages((prev) => [...prev, thinkingPlaceholder]);
        scrollToBottom();

        try {
            const idToken = await user.getIdToken();
            // Call the dedicated messages endpoint for the session
            const response = await fetch(`/api/sessions/${currentSessionId}/messages`, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    // Ensure the body matches what the messages endpoint expects
                    // Assuming it expects a 'message' field based on previous context
                    message: messageText 
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
                throw new Error(errorData.error || 'Failed to send message');
            }

            // Expecting the response structure defined by AssistantApiResponse
            const assistantResponseData: AssistantApiResponse = await response.json();

            // Check if the API indicated processing (like ADK call was made but result pending)
            // This depends on how messages/route.ts handles ADK interaction
            if (assistantResponseData.processing) {
                 console.log("Assistant is processing... (waiting for subsequent update or WebSocket)");
                 // Keep the thinking message for now, or replace it depending on desired UX
                 // Or remove optimistic user message if needed
            } else if (assistantResponseData.text) { // Handle direct text response
                const assistantMessage: DisplayMessage = {
                    messageId: assistantResponseData.messageId || `assistant-${Date.now()}`,
                    sender: 'assistant',
                    text: assistantResponseData.text,
                    createdAt: new Date(), 
                    role: 'assistant', // Role is fixed in AssistantApiResponse
                    next_actions: assistantResponseData.next_actions || [],
                };

                setMessages((prev) => {
                    const filteredPrev = prev.filter(m => 
                        m.messageId !== optimisticUserMessage.messageId && 
                        m.messageId !== thinkingMessageId
                    );
                    const confirmedUserMessage = { ...optimisticUserMessage, messageId: `user-${Date.now()}-${Math.random()}` };
                    return [...filteredPrev, confirmedUserMessage, assistantMessage];
                });
             } else {
                 // Handle case where response is OK but no text/processing flag
                 console.warn("Received OK response from messages endpoint without text or processing flag.");
                 // Remove thinking placeholder, maybe show a generic ack if needed
                 setMessages((prev) => prev.filter(m => m.messageId !== thinkingMessageId));
             }

        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessageText = error instanceof Error ? error.message : 'Could not reach assistant';
            const errorMessage: DisplayMessage = {
                messageId: `error-${Date.now()}`,
                sender: 'system',
                text: `Error: ${errorMessageText}`,
                createdAt: new Date(),
                role: 'system'
            };
             setMessages((prev) => {
                const filtered = prev.filter(m => 
                    m.messageId !== optimisticUserMessage.messageId &&
                    m.messageId !== thinkingMessageId
                );
                return [...filtered, errorMessage];
             });

        } finally {
            setIsLoading(false);
        }
    }, [user, currentSessionId, isLoading, scrollToBottom]); // Dependencies

    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        sendMessageToServer(input);
    };

    const handleNextActionClick = (actionText: string) => {
        sendMessageToServer(actionText); // Send the action text as a new message
    };

    // JSX Rendering - Add back the explicit Loading indicator if needed
    return (
        <div className="flex flex-col h-full max-h-[80vh] border rounded-md">
            <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
                {isFetchingMessages ? (
                    <div className="flex justify-center items-center h-full">
                        <p className="text-muted-foreground">Loading messages...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <p className="text-muted-foreground">No messages yet. Start a conversation!</p>
                    </div>
                ) :
                 (
                    messages.map((msg, index) => (
                        <MessageBubble
                            key={msg.messageId || `msg-${index}`}
                            message={msg}
                            onNextActionClick={handleNextActionClick}
                        />
                    ))
                )}
                {/* Optional: Explicit loading indicator was removed earlier, can be added back if desired 
                   while isLoading is true and the last message isn't the thinking placeholder */}
            </ScrollArea>
            <div className="border-t p-4">
                <form onSubmit={handleFormSubmit} className="flex items-center space-x-2">
                    <Input
                        type="text"
                        placeholder="Ask your AI Cofounder..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isLoading || isFetchingMessages}
                        className="flex-grow"
                    />
                    <Button
                        type="submit"
                        disabled={isLoading || isFetchingMessages || !input.trim()}
                        size="icon"
                    >
                        <SendHorizontal className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
};
