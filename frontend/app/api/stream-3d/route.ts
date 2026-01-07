import { NextRequest } from "next/server";

const FAL_API_BASE_URL = "https://fal.run";

export async function POST(request: NextRequest) {
  const falKey = process.env.FAL_KEY;
  const endpointId = process.env.FAL_ENDPOINT_ID;

  if (!falKey) {
    return new Response(JSON.stringify({ error: "FAL_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!endpointId) {
    return new Response(JSON.stringify({ error: "FAL_ENDPOINT_ID not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { imageUrl, prompt, streamGeometryEvery = 1, streamColorsEvery = 2 } = body;

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Missing imageUrl" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Make request to SAM-3D endpoint
    const response = await fetch(`${FAL_API_BASE_URL}/${endpointId}/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${falKey}`,
      },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt: prompt || "",
        stream_geometry_every: streamGeometryEvery,
        stream_colors_every: streamColorsEvery,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `SAM-3D error: ${errorText}` }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!response.body) {
      return new Response(JSON.stringify({ error: "No response body" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stream the SSE response to the client
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Stream 3D error:", error);
    return new Response(JSON.stringify({ error: "Failed to stream" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
