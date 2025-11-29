const OpenAI = require('openai').default;
const { toFile } = require('openai');

export class TranscriptionService {
  private openai: any;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: await toFile(audioBuffer, 'audio.webm', {
          type: 'audio/webm',
        }),
        model: 'whisper-1',
        language: 'en',
      });

      return transcription.text;
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }
}
