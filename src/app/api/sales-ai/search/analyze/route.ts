import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
// Helper function to clean and parse JSON from Gemini response
function parseGeminiResponse(text: string) {
  try {
    // Remove markdown code block if present
    const cleanedText = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    throw new Error('Failed to parse AI response');
  }
}

export async function POST(request: Request) {
  try {
    const { products, answers } = await request.json();

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'Invalid products data' },
        { status: 400 }
      );
    }

    // Initialize Gemini Pro model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // If answers are provided, generate recommendation
    if (answers) {
      const recommendationPrompt = `
        Based on the user's answers and the product details, recommend the best product and explain why.
        Format the response as a JSON object with 'recommendedProductId' and 'explanation' properties.
        Products:
        ${JSON.stringify(products, null, 2)}
        User's answers:
        ${JSON.stringify(answers, null, 2)}
      `;

      const recommendationResult = await model.generateContent(recommendationPrompt);
      const recommendationResponse = await recommendationResult.response;
      const recommendation = parseGeminiResponse(recommendationResponse.text());

      return NextResponse.json({ recommendation });
    }

    // Generate questions with answer options based on product comparison
    const questionsPrompt = `
      Analyze these products and generate 5 unique, relevant questions to help determine the best product for a user.
      For each question, provide 3-4 specific answer options that would help understand the user's preferences.
      Format the response as a JSON array of objects with 'id', 'text', and 'options' properties.
      The 'options' should be an array of strings representing possible answers.
      Products to analyze:
      ${JSON.stringify(products, null, 2)}
    `;

    const questionsResult = await model.generateContent(questionsPrompt);
    const questionsResponse = await questionsResult.response;
    const questions = parseGeminiResponse(questionsResponse.text());

    return NextResponse.json({ questions });

  } catch (error) {
    console.error('Error in product analysis:', error);
    return NextResponse.json(
      { error: 'Failed to analyze products' },
      { status: 500 }
    );
  }
} 