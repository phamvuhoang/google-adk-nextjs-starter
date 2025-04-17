'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import UserNav from '@/components/user-nav'; // Corrected path

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login if not loading and no user is authenticated
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Display loading indicator while checking auth state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Render children only if user is authenticated
  if (user) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 w-full border-b bg-background">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center space-x-2">
              {/* You can replace this with an actual logo component if you have one */}
              {/* <YourLogoComponent className="h-6 w-6" /> */}
              <div className="text-lg font-semibold">AI Agent</div>
            </div>
            {/* User Navigation - Assuming a UserNav component */}
            {/* This component typically includes Avatar and Dropdown for user actions like logout */}
            <UserNav user={user} signOut={signOut} />
          </div>
        </header>
        <main className="flex-1 container py-6">
           {children}
        </main>
      </div>
    );
  }

  // Return null or redirect component if needed, though useEffect should handle redirection
  return null; 
} 