import Link from "next/link";
import Image from 'next/image';
import { LoginForm } from "@/components/login-form";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login | MixerAI 2.0',
  description: 'Log in to your MixerAI account to access the dashboard.',
};

/**
 * LoginPage component.
 * Displays the login page, including the MixerAI logo and the LoginForm component.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <Link href="/" aria-label="Go to homepage">
            <Image 
              src="/Mixerai2.0Logo.png" 
              alt="MixerAI 2.0 Logo"
              width={250}
              height={58}
              priority 
            />
          </Link>
        </div>
        
        <LoginForm />
      </div>
    </div>
  );
} 