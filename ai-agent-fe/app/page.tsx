import Link from 'next/link';
import { Button } from '@/components/ui/button'; // Assuming shadcn/ui Button component is available

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="px-4 lg:px-6 h-16 flex items-center justify-between border-b">
        <Link href="#" className="flex items-center justify-center" prefetch={false}>
          {/* Optional: Add a logo here */}
          <span className="text-xl font-semibold">google-adk-nextjs-starter</span>
        </Link>
        <nav className="flex gap-4 sm:gap-6">
          <Link
            href="/login"
            className="text-sm font-medium hover:underline underline-offset-4"
            prefetch={false}
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="text-sm font-medium hover:underline underline-offset-4"
            prefetch={false}
          >
            Sign Up
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 text-center">
          <div className="container px-4 md:px-6">
            <div className="space-y-4">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                Unlock Your Ideas with AI
              </h1>
              <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                Leverage our AI Agent for brainstorming, idea validation, market research, and more. Built with Google ADK and Next.js.
              </p>
              <div className="space-x-4">
                <Button asChild>
                   <Link href="/signup">Get Started</Link>
                 </Button>
                 <Button variant="outline" asChild>
                   <Link href="/login">Login</Link>
                 </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Features</h2>
              <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                Explore the powerful capabilities of our AI-driven platform.
              </p>
            </div>
            <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3">
              <div className="grid gap-1 p-4 rounded-lg border bg-white dark:bg-gray-950 shadow-sm">
                <h3 className="text-lg font-bold">Idea Brainstorming</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Generate innovative ideas and explore new possibilities with AI assistance.
                </p>
              </div>
              <div className="grid gap-1 p-4 rounded-lg border bg-white dark:bg-gray-950 shadow-sm">
                <h3 className="text-lg font-bold">Idea Validation</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Assess the potential of your ideas with data-driven insights and feedback.
                </p>
              </div>
              <div className="grid gap-1 p-4 rounded-lg border bg-white dark:bg-gray-950 shadow-sm">
                <h3 className="text-lg font-bold">Market Research</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Gain comprehensive market understanding and identify key trends.
                </p>
              </div>
               {/* Add more feature blocks if needed */}
            </div>
          </div>
        </section>

        {/* Call to Action Section (Optional) */}
        {/* Add a section here encouraging users to sign up or learn more */}

      </main>

      {/* Footer */}
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          © {new Date().getFullYear()} google-adk-nextjs-starter. All rights reserved.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Terms of Service
          </Link>
          <Link href="#" className="text-xs hover:underline underline-offset-4" prefetch={false}>
            Privacy Policy
          </Link>
        </nav>
      </footer>
    </div>
  );
}
