'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, ChevronRight } from 'lucide-react';

// Type definition for session data
interface SessionSummary {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status?: 'active' | 'archived' | 'completed';
}

function ChatPageInternal() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Fetch user sessions
  useEffect(() => {
    const fetchSessions = async () => {
      if (!user) return;

      try {
        setIsLoadingSessions(true);
        const idToken = await user.getIdToken();
        const response = await fetch('/api/sessions', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setSessions(data);
        } else {
          console.error('Failed to fetch sessions');
        }
      } catch (error) {
        console.error('Error fetching sessions:', error);
      } finally {
        setIsLoadingSessions(false);
      }
    };

    fetchSessions();
  }, [user]);

  // Create a new session
  const handleCreateSession = async () => {
    if (!user) return;

    try {
      setIsCreatingSession(true);
      const idToken = await user.getIdToken();
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          title: `New session ${new Date().toLocaleString()}`
        })
      });

      if (response.ok) {
        const newSession = await response.json();
        router.push(`/chat?sessionId=${newSession.sessionId}`);
      } else {
        console.error('Failed to create session');
      }
    } catch (error) {
      console.error('Error creating session:', error);
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Render the session selection UI when no session is selected
  if (!sessionId) {
    return (
      <div className="p-4 py-8 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Your Sessions</h1>
          <Button 
            onClick={handleCreateSession} 
            disabled={isCreatingSession}
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            New Session
          </Button>
        </div>

        {isLoadingSessions ? (
          // Loading placeholder
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center p-3 border rounded-md animate-pulse">
                <div className="flex-1">
                  <div className="h-5 w-3/4 mb-2 bg-gray-200 rounded"></div>
                  <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
                </div>
                <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          // No sessions
          <div className="text-center py-10 border rounded-md bg-muted/50">
            <p className="text-lg mb-4">You don&apos;t have any sessions yet</p>
            <Button onClick={handleCreateSession} disabled={isCreatingSession}>
              Start a New Conversation
            </Button>
          </div>
        ) : (
          // Session list
          <div className="space-y-3">
            {sessions.map(session => (
              <button
                key={session.sessionId}
                className="w-full flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors text-left"
                onClick={() => router.push(`/chat?sessionId=${session.sessionId}`)}
              >
                <div>
                  <h3 className="font-medium">{session.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(session.updatedAt).toLocaleString()}
                  </p>
                </div>
                <ChevronRight size={18} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Render ChatInterface for the selected session
  if (!user) {
    return <div className="p-4">Loading user or Please log in...</div>;
  }

  return (
    <div className="p-4 py-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">AI Cofounder Chat</h1>
        <Button 
          variant="outline" 
          onClick={() => router.push('/chat')}
        >
          All Sessions
        </Button>
      </div>
      <ChatInterface sessionId={sessionId} />
    </div>
  );
}

export default function ChatPage() {
  return <ChatPageInternal />;
} 