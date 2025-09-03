// Vercel Serverless Function
// This function handles the image analysis.
// It receives a base64 encoded image, sends it to the Gemini API,
// and returns the extracted text, language, and Chinese translation.

export const config = {
    maxDuration: 60, // Allow up to 60 seconds for the function to run
};

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { image } = request.body;
        if (!image) {
            return response.status(400).json({ error: 'No image data provided.' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        // Construct the prompt for Gemini
        const prompt = `
            Analyze the following image which contains a text conversation.
            1. Extract all text from the image.
            2. Identify the language of the extracted text.
            3. Translate the extracted text into Simplified Chinese (中文).
            4. Provide the response as a valid JSON object with the following keys: "language", "originalText", "translatedText".
            
            Example response format:
            {
              "language": "Swedish",
              "originalText": "Ska vi ta en fika imorgon?",
              "translatedText": "我们明天要不要一起喝杯咖啡？"
            }
        `;

        // Construct the payload for Gemini API
        const payload = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: "image/jpeg", // Assuming jpeg, png is also common
                                data: image
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
              responseMimeType: "application/json",
            }
        };
        
        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
            const errorBody = await apiResponse.text();
            console.error('Gemini API Error:', errorBody);
            throw new Error(`Gemini API failed with status: ${apiResponse.status}`);
        }

        const result = await apiResponse.json();
        
        // Extract the JSON text from the response
        const candidate = result.candidates?.[0];
        if (!candidate || !candidate.content?.parts?.[0]?.text) {
          throw new Error('Invalid response structure from Gemini API.');
        }

        // The model should return a JSON string, so we parse it.
        const parsedResult = JSON.parse(candidate.content.parts[0].text);
        
        return response.status(200).json(parsedResult);

    } catch (error) {
        console.error('Error in analyzeImage handler:', error);
        return response.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}
