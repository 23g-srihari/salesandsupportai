import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, Content } from '@google/generative-ai'; // Added Content type

// --- Environment Variables ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

// --- Constants ---
const EMBEDDING_MODEL_NAME = "text-embedding-004";
const GENERATIVE_MODEL_NAME = "gemini-2.0-flash"; // Or your preferred generative model
const SIMILARITY_THRESHOLD = 0.5;
const MATCH_COUNT = 3;
const MAX_CONVERSATION_HISTORY = 6; // Number of past messages (user + AI = 1 turn) to include

const commonConversationalPhrases = [
    "hello", "hi", "hey", "greetings", "good morning", "good afternoon", "good evening", "sup", "yo",
    "how are you", "how are you doing", "hows it going", "how\'s it going", "what\'s up", "whats up",
    "thank you", "thanks", "thank u", "thx", "appreciated",
    "ok", "okay", "sounds good", "got it", "great", "cool", "alright", "sure"
];
const inquiryKeywords = ["help", "issue", "fix", "problem", "error", "how to", "what is", "can you", "explain", "tell me about", "i need to", "document", "support", "unable"];

// --- System Prompts ---
const conversationalSystemPrompt = `You are a friendly, empathetic, and conversational AI customer support assistant for "SalesAndSupportAI".
The user has made a common conversational remark (like a greeting, asking how you are, expressing thanks, or a simple acknowledgement).
Respond naturally and politely, like a helpful friend would, considering the preceding conversation history if provided.
- If it's a greeting, greet them back and gently ask how you can be of assistance with SalesAndSupportAI topics.
- If they ask how you are, respond positively (e.g., "I'm doing well, thanks for asking! I'm here and ready to help you with any questions about SalesAndSupportAI.") and steer towards their support needs.
- If they say thank you, acknowledge it warmly (e.g., "You're very welcome! Is there anything else related to SalesAndSupportAI I can help you with today?").
- If it's a simple acknowledgement like "ok" or "got it", affirm and ask if they have any questions or if there's something specific you can look up for them in the SalesAndSupportAI documents.
Keep your response concise initially and primarily focused on being available for their support needs regarding SalesAndSupportAI. Avoid getting into extended non-support related chats unless the user explicitly drives it.`;

const ragSystemPrompt = `You are a friendly, empathetic, and helpful AI customer support assistant for "SalesAndSupportAI".
You have been provided with relevant snippets from the company's knowledge base and the preceding conversation history to answer the user's specific question.
Your primary goal is to assist the user by answering their question based *only* on the information contained in these provided document snippets and the flow of the conversation.
Engage in a natural, conversational manner while delivering the information.

When answering:
- If the provided snippets directly answer the user's question, explain the information clearly and concisely from the snippets, relating it to the conversation if appropriate.
- If the snippets provide some relevant information but don't fully answer the question, explain what you found and clearly state what parts of the question cannot be answered from the provided snippets.
- Do not make up information or answer from outside the provided document snippets.
- If providing steps or lists from the snippets, format them clearly.`;

const getFallbackPromptNoChunks = (userMessage: string): string => {
  return `You are a friendly and empathetic AI customer support assistant for "SalesAndSupportAI".
The user has described an issue or asked a question: "${userMessage}".
You have searched the company's knowledge documents based on this query, but you could not find any specific troubleshooting steps or information directly related to it. Consider the preceding conversation history.
Acknowledge their problem with empathy first. Then, politely inform them that you couldn't find a solution in the current documents.
For example: "Oh no, it sounds frustrating that your battery isn't lasting long! I've had a good look through our SalesAndSupportAI knowledge base, but unfortunately, I couldn't find any specific troubleshooting tips for battery issues right now. Would you like me to search for information on another topic, or perhaps you could provide more details about the device or context if you think that might help me find something related?"
Avoid making generic suggestions if you have no basis for them. Focus on the lack of specific documentation for *this* issue.`;
};

// --- Initialize Clients ---
let supabaseAdmin: SupabaseClient;
let genAI: GoogleGenerativeAI;
let embeddingModel: any;
let generativeModel: any;

if (supabaseUrl && supabaseServiceRoleKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
} else {
  // console.warn("Supabase URL or Service Role Key not provided. Supabase client for chat API not initialized.");
}

if (geminiApiKey) {
  genAI = new GoogleGenerativeAI(geminiApiKey);
  embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL_NAME });

  const generationConfig: GenerationConfig = {
    candidateCount: 1,
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
  };
  generativeModel = genAI.getGenerativeModel({
    model: GENERATIVE_MODEL_NAME,
    generationConfig,
  });
} else {
  // console.warn("Gemini API Key not provided. Google AI clients for chat API not initialized.");
}

// Helper to format conversation history for the prompt string
function formatHistoryForPrompt(history: Array<{ role: string; parts: { text: string }[] }>): string {
    if (!history || history.length === 0) return "";
    return history.map(turn => {
        const roleLabel = turn.role === 'user' ? 'User' : 'AI';
        const textContent = turn.parts && turn.parts[0] && typeof turn.parts[0].text === 'string' ? turn.parts[0].text : '';
        return `${roleLabel}: ${textContent}`;
    }).join("\n") + "\n\n"; // Add double newline for separation before the main prompt part
}

export async function POST(req: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Chat API Supabase client not initialized." }, { status: 500 });
  }
  if (!genAI || !embeddingModel || !generativeModel) {
    return NextResponse.json({ error: "Chat API Google AI clients not initialized." }, { status: 500 });
  }

  try {
    const body = await req.json();
    const userMessage = (body.message as string || "").trim();
    const conversationHistory = (body.conversationHistory as Array<{ role: string; parts: { text: string }[] }> || []).slice(-MAX_CONVERSATION_HISTORY);

    if (!userMessage) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }
    // console.log("[Chat API] Received user message:", userMessage);
    if (conversationHistory.length > 0) {
        // console.log("[Chat API] Received conversation history length:", conversationHistory.length);
    }

    const historyString = formatHistoryForPrompt(conversationHistory);

    const normalizedUserMessage = userMessage.toLowerCase();
    let isLikelyConversational = commonConversationalPhrases.some(phrase => normalizedUserMessage.includes(phrase));
    const containsInquiryKeyword = inquiryKeywords.some(kw => normalizedUserMessage.includes(kw));
    const containsQuestionMark = normalizedUserMessage.includes("?");

    if (isLikelyConversational) {
        if (containsInquiryKeyword || containsQuestionMark) {
            const isCommonQuestion = ["how are you", "how are you doing", "hows it going", "how\'s it going", "what\'s up", "whats up"].some(q => normalizedUserMessage.startsWith(q));
            if (!isCommonQuestion) {
                isLikelyConversational = false; 
            }
        }
    }

    let finalPromptForGemini: string;
    let useRAG = !isLikelyConversational;

    if (!useRAG) {
      // console.log("[Chat API] Input classified as conversational. Responding directly.");
      finalPromptForGemini = `${historyString}${conversationalSystemPrompt}

User: "${userMessage}"
AI Assistant:`;
    } else {
      // console.log("[Chat API] Proceeding with RAG pipeline for:", userMessage);
      
      // console.log("[Chat API] Embedding user query...");
      let queryEmbedding;
      try {
          const embedResult = await embeddingModel.embedContent(userMessage);
          queryEmbedding = embedResult.embedding.values;
      } catch (embedError) {
          // console.error("[Chat API] Error embedding user query:", embedError);
          return NextResponse.json({ error: "Failed to process your query (embedding failed)." }, { status: 500 });
      }
      if (!queryEmbedding) {
          // console.error("[Chat API] Query embedding resulted in undefined.");
          return NextResponse.json({ error: "Failed to process your query (empty embedding)." }, { status: 500 });
      }
      // console.log("[Chat API] User query embedded.");

      // console.log("[Chat API] Searching for relevant document chunks...");
      const { data: chunks, error: rpcError } = await supabaseAdmin.rpc('match_support_document_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: SIMILARITY_THRESHOLD,
        match_count: MATCH_COUNT,
      });

      if (rpcError) {
        // console.error("[Chat API] Error calling RPC for document matching:", rpcError);
        return NextResponse.json({ error: "Failed to search relevant documents." }, { status: 500 });
      }

      if (!chunks || chunks.length === 0) {
        // console.log("[Chat API] No relevant document chunks found for query:", userMessage);
        finalPromptForGemini = `${historyString}${getFallbackPromptNoChunks(userMessage)}

User Message (that had no results): "${userMessage}"
AI Assistant:`;
      } else {
        // console.log(`[Chat API] Found ${chunks.length} relevant chunks for query:`, userMessage);
        const contextSnippets = chunks.map((chunk: any, index: number) => `Snippet ${index + 1}:\n${chunk.chunk_text}`).join("\n\n---\n\n");
        finalPromptForGemini = `${historyString}${ragSystemPrompt}

CONTEXT FROM RELEVANT DOCUMENTS:
---
${contextSnippets}
---

User's Current Question: "${userMessage}"

Answer:`;
      }
    }

    // console.log("[Chat API] Sending final prompt to Gemini generative model...");
    // console.log("Full prompt for Gemini:", finalPromptForGemini); // For debugging

    // For models that support direct history array, this would be preferred:
    // const historyForSDK: Content[] = conversationHistory.map(turn => ({ role: turn.role, parts: turn.parts }));
    // const result = await generativeModel.startChat({ history: historyForSDK }).sendMessage(currentPromptForUserTurn);
    // For now, using concatenated string prompt for broader compatibility
    const result = await generativeModel.generateContent(finalPromptForGemini);
    const response = result.response;
    let aiResponseText = "I apologize, I encountered an issue generating a response. Please try again.";
    if (response && typeof response.text === 'function') {
        aiResponseText = response.text();
    } else {
        // console.error("[Chat API] Unexpected response structure from Gemini model:", response);
    }

    // console.log("[Chat API] Received response from Gemini.");
    return NextResponse.json({ answer: aiResponseText });

  } catch (error: any) {
    // console.error("[Chat API] Unhandled error in POST handler:", error);
    return NextResponse.json({ error: `An unexpected error occurred: ${error.message}` }, { status: 500 });
  }
}
