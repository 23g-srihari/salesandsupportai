import NextAuth from 'next-auth';
import { authOptions } from '@/utils/authOptions'; // Import authOptions from the new utility file

const handler = NextAuth(authOptions); // Use the imported options

export { handler as GET, handler as POST };