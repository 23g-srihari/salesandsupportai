import Link from "next/link";
import { FaChartLine, FaHeadset } from "react-icons/fa";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-gray-100">
      <h1 className="text-5xl font-extrabold mb-14 text-center text-green-200 drop-shadow-lg tracking-tight">SalesandSupportAI</h1>
      <div className="flex flex-col md:flex-row gap-10">
        <Link href="/sales-ai" className="group bg-gradient-to-br from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 transition-all rounded-3xl shadow-2xl p-12 w-72 flex flex-col items-center justify-center text-center cursor-pointer border-2 border-green-300 hover:border-green-100 scale-100 hover:scale-105 duration-200">
          <FaChartLine className="text-5xl mb-4 text-green-100 group-hover:text-white drop-shadow" />
          <span className="text-2xl font-bold mb-2 text-white group-hover:text-green-900">SalesAI</span>
          <span className="text-green-100 group-hover:text-green-900">AI-powered sales assistant</span>
        </Link>
        <Link href="/support-ai" className="group bg-gradient-to-br from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 transition-all rounded-3xl shadow-2xl p-12 w-72 flex flex-col items-center justify-center text-center cursor-pointer border-2 border-green-300 hover:border-green-100 scale-100 hover:scale-105 duration-200">
          <FaHeadset className="text-5xl mb-4 text-green-100 group-hover:text-white drop-shadow" />
          <span className="text-2xl font-bold mb-2 text-white group-hover:text-green-900">SupportAI</span>
          <span className="text-green-100 group-hover:text-green-900">AI-powered support assistant</span>
        </Link>
      </div>
    </div>
  );
}
