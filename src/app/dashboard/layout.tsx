'use client';

import Link from "next/link";
import { Button } from "@/components/button";
// import { NotificationCenter } from "@/components/dashboard/notification-center";
import { UnifiedNavigation } from "@/components/layout/unified-navigation";
import { BottomMobileNavigation } from "@/components/layout/BottomMobileNavigation";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { toast as sonnerToast } from "sonner";
import { LogOut, UserCircle2, ChevronDown, Loader2 } from "lucide-react";
import React, { useState, useEffect, Suspense } from "react";
import Image from 'next/image';

// Define UserSessionData interface (can be shared if defined elsewhere)
interface UserSessionData {
  id: string;
  email?: string;
  user_metadata?: {
    role?: string;
    full_name?: string;
    avatar_url?: string; // Expecting avatar_url here from user_metadata or profile
  };
  brand_permissions?: Array<{
    brand_id: string;
    role: string; 
  }>;
  avatar_url?: string; // Or directly on the user object from /api/me if profile is merged
  full_name?: string; // Fallback if not in user_metadata
}

/**
 * DashboardLayout component.
 * Provides the main layout structure for all authenticated dashboard pages.
 * Includes a header with navigation and user actions, and a sidebar navigation.
 */
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      setIsLoadingUser(true);
      try {
        const response = await fetch('/api/me'); 
        if (!response.ok) {
          throw new Error('Failed to fetch user session for layout');
        }
        const data = await response.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
          // console.error("[DashboardLayout] Failed to get user data from /api/me:", data.error);
          // Potentially redirect to login if user is null and not on a public part of dashboard
        }
      } catch (error) {
        // console.error('[DashboardLayout] Error fetching current user:', error);
        setCurrentUser(null);
      } finally {
        setIsLoadingUser(false);
      }
    };
    fetchCurrentUser();
  }, []);
  
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      sonnerToast.success("You have been successfully signed out.");

      router.push('/auth/login');
      router.refresh(); // Ensures the layout re-evaluates auth state
    } catch (error: any) {
      sonnerToast.error(error?.message || "There was a problem signing out. Please try again.");
    }
  };

  const displayName = currentUser?.user_metadata?.full_name || currentUser?.full_name || 'User';
  const avatarUrl = currentUser?.avatar_url || currentUser?.user_metadata?.avatar_url;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-secondary text-secondary-foreground sticky top-0 z-40 h-16">
        <div className="w-full mx-auto px-4 py-3 flex items-center justify-between h-full">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Image 
              src="/Mixerai2.0Logo.png" 
              alt="MixerAI 2.0 Logo"
              width={225}
              height={52}
              priority 
            />
          </Link>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button
              size="sm"
              asChild
              className="hidden sm:flex bg-yellow-400 text-neutral-800 hover:bg-yellow-500 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-yellow-400 dark:bg-yellow-500 dark:text-neutral-900 dark:hover:bg-yellow-600 dark:focus-visible:ring-yellow-500"
            >
              <Link href="https://teams.microsoft.com/l/chat/0/0?users=peter.pitcher@genmills.com" target="_blank" rel="noopener noreferrer">
                Get Help
              </Link>
            </Button>

            {isLoadingUser ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : currentUser ? (
              <>
                <div className="flex items-center space-x-2">
                  {avatarUrl ? (
                    avatarUrl.includes('api.dicebear.com') ? (
                      <img 
                        src={avatarUrl} 
                        alt={displayName} 
                        width={32} 
                        height={32} 
                        className="rounded-full" 
                      />
                    ) : (
                      <Image 
                        src={avatarUrl} 
                        alt={displayName} 
                        width={32} 
                        height={32} 
                        className="rounded-full" 
                      />
                    )
                  ) : (
                    <UserCircle2 className="h-8 w-8" />
                  )}
                  <span className="hidden sm:inline text-sm font-medium">
                    {displayName}
                  </span>
                </div>
              </>
            ) : null}
            <Button 
              variant="ghost" 
              className="text-secondary-foreground hover:bg-black/10"
              onClick={handleSignOut}
              aria-label="Log out"
              disabled={isLoadingUser}
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline ml-2">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <Suspense fallback={<div className="w-64 p-4 border-r"><Loader2 className="h-6 w-6 animate-spin mx-auto mt-8" /></div>}>
          <UnifiedNavigation />
        </Suspense>
        <main className="flex-1 p-4 sm:p-6 overflow-auto lg:pb-0 pb-20">
          {process.env.NODE_ENV === 'development' && (
            <div id="domain-verification-container" className="mb-4">
              {/* This will be populated client-side */}
            </div>
          )}
          {children}
        </main>
      </div>
      <BottomMobileNavigation />
    </div>
  );
} 