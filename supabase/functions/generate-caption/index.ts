import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, type = 'generate', provider } = await req.json();
    
    let prompt = '';
    
    if (type === 'surprise') {
      prompt = 'Generate a funny, creative, and viral meme caption. Make it witty, relatable, and perfect for social media sharing. Keep it under 50 words and make it punchy.';
    } else {
      prompt = `Create a funny and engaging meme caption based on this description: "${description}". Make it witty, relatable, and perfect for social media. Keep it under 50 words and make it punchy.`;
    }

    console.log('Generating caption with prompt:', prompt);

    // Choose provider: explicit > Perplexity (if key exists) > OpenAI
    const chosenProvider = (provider && typeof provider === 'string')
      ? provider.toLowerCase()
      : (perplexityApiKey ? 'perplexity' : 'openai');

    let caption = '';

    if (chosenProvider === 'perplexity') {
      if (!perplexityApiKey) {
        throw new Error('PERPLEXITY_API_KEY not configured.');
      }

      const resp = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            { role: 'system', content: 'Be precise and concise. Generate only the meme caption text without quotes.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          top_p: 0.9,
          max_tokens: 120,
          return_images: false,
          return_related_questions: false,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        console.error('Perplexity API error:', errorData);
        let msg = `Perplexity API error: ${resp.status}`;
        if (resp.status === 401) msg = 'Invalid Perplexity API key.';
        if (resp.status === 429) msg = 'Perplexity rate limit exceeded. Try again later.';
        throw new Error(msg);
      }

      const pdata = await resp.json();
      caption = (pdata?.choices?.[0]?.message?.content ?? '').trim();
    } else {
      if (!openAIApiKey) {
        throw new Error('OPENAI_API_KEY not configured.');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: 'You are a creative meme caption generator. Create funny, viral-worthy captions that are witty and relatable. Always respond with just the caption text, no quotes or explanations.' 
            },
            { role: 'user', content: prompt }
          ],
          max_tokens: 100,
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API error:', errorData);
        
        let errorMessage = `OpenAI API error: ${response.status}`;
        if (response.status === 429) {
          errorMessage = 'OpenAI API rate limit exceeded. Please check your API key quota or try again later.';
        } else if (response.status === 401) {
          errorMessage = 'Invalid OpenAI API key. Please check your API key configuration.';
        } else if (response.status === 403) {
          errorMessage = 'OpenAI API access forbidden. Please check your API key permissions.';
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      caption = data.choices[0].message.content.trim();
    }

    console.log('Generated caption:', caption);

    return new Response(JSON.stringify({ caption }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-caption function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate caption', 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});