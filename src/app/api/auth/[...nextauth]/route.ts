import NextAuth, { NextAuthOptions } from 'next-auth'; // Import NextAuthOptions
import GoogleProvider from 'next-auth/providers/google';

// Define and export your authOptions
export const authOptions: NextAuthOptions = { // <--- Define and export here
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file', // Ensure drive.file for uploads if needed by picker, or broad Drive access
          access_type: "offline", // Required to get a refresh token
          prompt: "consent",       // Ensures user sees consent screen & gets refresh token on first login or scope change
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        // Save access_token, refresh_token, and expiry time to JWT
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : undefined;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client, like an access_token and user id from a provider.
      if (session.user) {
        (session as any).accessToken = token.accessToken;
        (session as any).refreshToken = token.refreshToken;
        (session as any).error = token.error; // Pass error to session if token refresh fails
      }
      return session;
    },
  },
  // Ensure you have a secret for production, typically set via NEXTAUTH_SECRET environment variable
   secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions); // Use the defined options

export { handler as GET, handler as POST };