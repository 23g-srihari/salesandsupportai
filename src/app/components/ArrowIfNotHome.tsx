'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaArrowCircleLeft } from 'react-icons/fa';

export default function ArrowIfNotHome() {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return (
    <Link href="/" className="inline-flex items-center mt-10 ml-16 text-green-400 hover:text-green-300 transition-all duration-200">
      <FaArrowCircleLeft className="w-12 h-12 drop-shadow-lg opacity-60" />
    </Link>
  );
} 