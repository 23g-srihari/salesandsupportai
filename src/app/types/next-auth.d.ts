import NextAuth from 'next-auth';

// Extend the Session type to include Google tokens
declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
  }
} 