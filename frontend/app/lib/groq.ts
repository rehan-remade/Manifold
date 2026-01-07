const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface EnhancedPrompts {
  imagePrompt: string;
  segmentationPrompt: string;
}

const SYSTEM_PROMPT = `You are a prompt engineer specializing in text-to-image generation and 3D object segmentation.

When given a user's description, you must return a JSON object with exactly two fields:
1. "imagePrompt": An enhanced, detailed prompt optimized for generating a single, well-lit, centered object image suitable for 3D reconstruction. The object should be on a clean, neutral background. Add details about materials, lighting, and composition. Keep it concise but descriptive.
2. "segmentationPrompt": A simple 1-3 word label identifying the main object in the image (e.g., "car", "wooden chair", "red sneaker"). This will be used for object segmentation.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.`;

export async function enhancePromptWithGroq(
  userPrompt: string,
  apiKey: string
): Promise<EnhancedPrompts> {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response from Groq");
  }

  try {
    const parsed = JSON.parse(content);
    return {
      imagePrompt: parsed.imagePrompt || userPrompt,
      segmentationPrompt: parsed.segmentationPrompt || userPrompt,
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      imagePrompt: userPrompt,
      segmentationPrompt: userPrompt,
    };
  }
}
