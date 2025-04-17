'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { FcGoogle } from 'react-icons/fc';
import { Separator } from '@/components/ui/separator';

export default function LoginPage() {
  const { signInWithEmail, signInWithGoogle, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmail(email, password);
      // Redirect is handled by AuthProvider on success
    } catch (err: unknown) {
      console.error("Email/Password Login exception:", err);
      if (err instanceof Error) {
          setError(err.message);
      } else {
          setError("An unexpected error occurred during login.");
      }
    }
  };

  const handleGoogleSignIn = async () => {
      setError(null);
      try {
          await signInWithGoogle();
          // Redirect is handled by AuthProvider on success
      } catch (err: unknown) {
         console.error("Google Login exception:", err);
         if (err instanceof Error) {
             setError(err.message);
         } else {
             setError("An unexpected error occurred during Google login.");
         }
      }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">Login</CardTitle>
          <CardDescription>Choose your login method</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignIn}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="m@example.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
             {error && !loading && <p className="text-sm text-destructive text-center">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col items-stretch gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
              Sign In with Email
            </Button>
          </CardFooter>
        </form>
         
        <div className="relative my-4 px-6">
            <div className="absolute inset-0 flex items-center">
                <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
        </div>

        <div className="px-6 pb-4"> 
            <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
                {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <FcGoogle className="mr-2 h-5 w-5" />
                )}
                Sign in with Google
            </Button>
        </div>

        <div className="pb-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline hover:text-primary">
                Sign up
            </Link>
        </div>

      </Card>
    </div>
  );
} 