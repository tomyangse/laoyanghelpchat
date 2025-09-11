// Vercel Serverless Function
// Handles image analysis: OCR, language detection, and translation.

import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const { image: base64ImageData } = await req.json();

        if (!base64ImageData) {
            return new Response(JSON.stringify({ error: 'No image data provided' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Use the gemini-pro-vision model for image analysis
        const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

        const prompt = "从这张图片中提取所有文字。然后，判断这些文字是什么语言（例如：English, Spanish, Chinese）。最后，将提取的文字翻译成简体中文。请以JSON格式返回结果，包含三个字段：'text' (提取的原文), 'language' (检测到的语言), 和 'translation' (中文翻译)。";
        
        const imagePart = {
            inlineData: {
                data: base64ImageData,
                mimeType: "image/jpeg", // Assuming jpeg, but the model is robust
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = result.response;
        const responseText = response.text();

        // Clean the response to get pure JSON
        const jsonString = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(jsonString);

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error("Error in analyzeImage API:", error);
        return new Response(JSON.stringify({ error: 'Failed to analyze image.', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

