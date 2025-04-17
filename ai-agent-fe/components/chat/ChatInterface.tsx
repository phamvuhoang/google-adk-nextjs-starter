'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timestamp } from 'firebase/firestore';
import { SendHorizontal } from 'lucide-react';
import { RawMessage, DisplayMessage, ChatInterfaceProps, AssistantApiResponse } from '@/lib/types/ui';

// Simple message display component
const MessageBubble: React.FC<{ message: DisplayMessage, onNextActionClick: (action: string) => void }> = ({ message, onNextActionClick }) => {
    const sender = message.sender || 'system';
    const text = message.text || '';
    const nextActions = message.next_actions || [];

    // Format Date object for display if needed, or rely on default string conversion
    // const displayTime = message.createdAt ? message.createdAt.toLocaleTimeString() : 'sending...';

    return (
        <div className={`flex flex-col ${sender === 'user' ? 'items-end' : 'items-start'} mb-2`}>
            <div
                className={`max-w-[70%] rounded-lg px-3 py-2 mb-1 ${sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                    }`}
            >
                {text}
                {/* Optional: Display timestamp */}
                {/* <div className="text-xs text-muted-foreground/70 mt-1">{displayTime}</div> */}
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
    const [currentSessionId, setCurrentSessionId] = useState<string>(initialSessionId);
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
                    // Use the RawMessage type here
                    const formattedMessages: DisplayMessage[] = (data.messages || []).map((msg: RawMessage) => {
                        let createdAtDate: Date | null = null;
                        if (msg.createdAt) {
                            if (typeof msg.createdAt === 'string') {
                                createdAtDate = new Date(msg.createdAt);
                            } else if (msg.createdAt instanceof Timestamp) {
                                createdAtDate = msg.createdAt.toDate();
                            }
                        }
                        return {
                            ...msg,
                            createdAt: createdAtDate,
                            next_actions: msg.next_actions || [], // Ensure next_actions is initialized
                        };
                    });

                    setMessages(formattedMessages);
                } else {
                    const errorData = await response.json();
                    console.error("Error fetching session messages:", errorData.error);
                    // Optionally display an error message in the chat
                     setMessages([{ messageId: `fetch-error-${Date.now()}`, sender: 'system', text: `Error loading messages: ${errorData.error || 'Unknown error'}`, createdAt: new Date() }]);
                }
            } catch (error) {
                console.error("Error fetching session messages:", error);
                // Optionally display an error message in the chat
                setMessages([{ messageId: `fetch-error-${Date.now()}`, sender: 'system', text: `Error loading messages: ${error instanceof Error ? error.message : 'Network error'}`, createdAt: new Date() }]);
            } finally {
                setIsFetchingMessages(false);
            }
        };

        fetchMessages();
    }, [user, currentSessionId]); // Depend on currentSessionId

    // Function to send message (used by form submit and next action click)
    const sendMessageToServer = useCallback(async (messageText: string) => {
        if (!messageText.trim() || isLoading || !user) return;

        const optimisticUserMessage: DisplayMessage = {
            messageId: `temp-${Date.now()}`,
            sender: 'user',
            text: messageText,
            createdAt: new Date(), // Use Date object directly
            role: 'user',
        };

        setMessages((prev) => [...prev, optimisticUserMessage]);
        setInput(''); // Clear input regardless of source
        setIsLoading(true);
        scrollToBottom();

        try {
            const idToken = await user.getIdToken();
            const response = await fetch(`/api/sessions/${currentSessionId}/messages`, { // Use the messages endpoint instead of ADK
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                // Send message directly
                body: JSON.stringify({ message: messageText }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || 'Failed to send message');
            }

            // API returns assistant message structure
            const assistantResponseData: AssistantApiResponse = await response.json();

             // Update session ID if the API returned a new one (e.g., for the first message)
             if (assistantResponseData.sessionId && assistantResponseData.sessionId !== currentSessionId) {
                 setCurrentSessionId(assistantResponseData.sessionId);
                 // Optionally update URL here if needed: history.pushState({}, '', `/chat/${assistantResponseData.sessionId}`);
             }

             // Handle potential processing flag (e.g., for function calls)
             if (assistantResponseData.processing) {
                // Optionally update UI to show processing state more explicitly
                // For now, we just won't add a message bubble for this response
                console.log("Assistant is processing the request...");
                // Remove optimistic user message if needed, or keep it and wait for final response
                 setMessages((prev) => prev.filter(m => m.messageId !== optimisticUserMessage.messageId));
                 // Add back the confirmed user message if desired
                 // setMessages((prev) => [...prev, {...optimisticUserMessage, messageId: `user-${Date.now()}`}]);

             } else if (assistantResponseData.text) { // Only add if there's text content

                const assistantMessage: DisplayMessage = {
                    messageId: assistantResponseData.messageId || `assistant-${Date.now()}`,
                    sender: 'assistant',
                    text: assistantResponseData.text,
                    createdAt: new Date(), // Use current time for assistant message
                    role: 'assistant',
                    next_actions: assistantResponseData.next_actions || [], // Include next actions
                };

                setMessages((prev) => {
                    // Remove temporary message and add confirmed user and assistant messages
                    const filteredPrev = prev.filter(m => m.messageId !== optimisticUserMessage.messageId);
                    // Generate a more stable user message ID
                    const confirmedUserMessage = { ...optimisticUserMessage, messageId: `user-${Date.now()}-${Math.random()}` };
                    return [...filteredPrev, confirmedUserMessage, assistantMessage];
                });
             } else {
                 // Handle cases where there's no text and no processing flag (e.g., unexpected empty response)
                 console.warn("Received assistant response without text or processing flag.");
                 // Remove optimistic message, don't add assistant message
                 setMessages((prev) => prev.filter(m => m.messageId !== optimisticUserMessage.messageId));
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
             // Remove optimistic message and add error message
             setMessages((prev) => {
                const filteredPrev = prev.filter(m => m.messageId !== optimisticUserMessage.messageId);
                return [...filteredPrev, errorMessage];
             });

        } finally {
            setIsLoading(false);
        }
    }, [user, currentSessionId, isLoading, scrollToBottom]); // Added dependencies

    const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        sendMessageToServer(input);
    };

    const handleNextActionClick = (actionText: string) => {
        sendMessageToServer(actionText); // Send the action text as a new message
    };

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
                            onNextActionClick={handleNextActionClick} // Pass handler
                        />
                    ))
                )}
                {isLoading && messages[messages.length -1]?.sender === 'user' && (
                    <div className="flex justify-start mb-2">
                        <div className="max-w-[70%] rounded-lg px-3 py-2 bg-muted animate-pulse">
                            Thinking...
                        </div>
                    </div>
                )}
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