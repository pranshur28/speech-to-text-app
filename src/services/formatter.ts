const OpenAI = require('openai').default;

export class TextFormatter {
  private openai: any;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async format(rawText: string): Promise<string> {
    try {
      const systemPrompt = `You are a text formatting assistant. Your job is to take raw transcribed text and format it properly. You should:
1. Add proper punctuation (periods, commas, etc.)
2. Fix capitalization
3. Create appropriate paragraph breaks based on topic changes or natural pauses
4. Organize the content logically
5. Remove filler words like "uh", "um" but keep the meaning intact
6. Make the text readable and well-structured

Return only the formatted text, no explanations or markdown.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 2048,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Please format this transcribed text:\n\n${rawText}`,
          },
        ],
      });

      // Extract the text content from the response
      const formattedText = response.choices[0]?.message?.content || rawText;

      return formattedText;
    } catch (error) {
      console.error('Formatting error:', error);
      throw error;
    }
  }
}
