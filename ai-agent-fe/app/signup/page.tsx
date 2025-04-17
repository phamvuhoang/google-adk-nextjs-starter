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

export default function SignUpPage() {
  const { signUpWithEmail, signInWithGoogle, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState(''); // Optional: Add display name field
  const [error, setError] = useState<string | null>(null);

  // --- Password Strength State ---
  const [passwordStrength, setPasswordStrength] = useState({
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false,
      valid: false,
  });

  const checkPasswordStrength = (pass: string) => {
      const length = pass.length >= 8;
      const uppercase = /[A-Z]/.test(pass);
      const lowercase = /[a-z]/.test(pass);
      const number = /[0-9]/.test(pass);
      const special = /[!@#$%^&*(),.?":{}|<>]/.test(pass); // Adjust special chars as needed
      const valid = length && uppercase && lowercase && number && special;
      setPasswordStrength({ length, uppercase, lowercase, number, special, valid });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newPassword = e.target.value;
      setPassword(newPassword);
      checkPasswordStrength(newPassword);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passwordStrength.valid) {
        setError("Password does not meet strength requirements.");
        return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await signUpWithEmail(email, password, displayName || undefined);
      // Redirect is handled by AuthProvider on success
      // Note: signUpWithEmail now throws on failure
    } catch (err: unknown) {
      console.error("Email/Password Sign up exception:", err);
       if (err instanceof Error) {
          setError(err.message); // Display the specific error message
      } else {
          setError("An unexpected error occurred during sign up.");
      }
    }
  };

  const handleGoogleSignIn = async () => {
      setError(null);
      try {
          await signInWithGoogle();
          // Redirect is handled by AuthProvider on success
      } catch (err: unknown) {
         console.error("Google Login exception (from signup page):", err);
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
          <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
          <CardDescription>Choose your sign up method</CardDescription>
        </CardHeader>
        <form onSubmit={handleSignUp}>
          <CardContent className="grid gap-4">
             <div className="grid gap-2">
              <Label htmlFor="displayName">Name (Optional)</Label>
              <Input 
                id="displayName" 
                type="text" 
                placeholder="Your Name" 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading}
              />
            </div>
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
                onChange={handlePasswordChange} // Use custom handler
                disabled={loading}
                aria-describedby="password-strength"
              />
              {/* Password Strength Indicator */}
              <div id="password-strength" className="text-xs mt-1 space-y-0.5">
                  <p className={passwordStrength.length ? 'text-green-600' : 'text-muted-foreground'}>- At least 8 characters</p>
                  <p className={passwordStrength.uppercase ? 'text-green-600' : 'text-muted-foreground'}>- At least one uppercase letter</p>
                  <p className={passwordStrength.lowercase ? 'text-green-600' : 'text-muted-foreground'}>- At least one lowercase letter</p>
                  <p className={passwordStrength.number ? 'text-green-600' : 'text-muted-foreground'}>- At least one number</p>
                  <p className={passwordStrength.special ? 'text-green-600' : 'text-muted-foreground'}>- At least one special character (!@#$...)</p>
              </div>
            </div>
             <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                required 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>
             {error && !loading && <p className="text-sm text-destructive text-center">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col items-stretch gap-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !passwordStrength.valid || password !== confirmPassword}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account with Email
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
                Sign up with Google
            </Button>
        </div>

        <div className="pb-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline hover:text-primary">
                Log in
            </Link>
        </div>
      </Card>
    </div>
  );
} 