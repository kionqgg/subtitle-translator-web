import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { parseAny } from '@/lib/parse';
import { formatAny } from '@/lib/format';
import { makeZip } from '@/lib/zip';

const Body = z.object({ name: z.string(), text: z.string().min(3), format: z.enum(['SRT','VTT','ASS','Unknown']), targets: z.array(z.string()).min(1), lineWidth: z.number().min(20).max(80) });

export async function POST(req: NextRequest){
  const body = await req.json();
  const { name, text, format, targets, lineWidth } = Body.parse(body);
  if (format === 'Unknown') return new Response('Unsupported format', { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response('Server missing OPENAI_API_KEY', { status: 500 });
  const client = new OpenAI({ apiKey });

  const parsed = parseAny(name, text);

  const systemPrompt = `You are a professional AV subtitle translator.\nStrictly preserve subtitle structure:\n- Do NOT invent or alter timestamps, indexes, style or position tags.\n- Keep the same number of lines per cue; reflow only within a cue to keep each line ≤ ${lineWidth} chars (prefer 1–2 lines).\n- Preserve speaker labels, italics, karaoke timing, and music symbols like ♪ unless translation is needed.\n- Output ONLY the translated text lines for the cue.`;

  const outputs: { lang: string; content: string }[] = [];

  for (const target of targets){
    const translated = [] as { index:number; timestamp:string; text:string }[];
    for (const cue of parsed.cues){
      const user = `FORMAT: ${parsed.format}\nINDEX: ${cue.index}\nTIMESTAMP: ${cue.timestamp}\nSOURCE:\n${cue.text}\nOUTPUT: Return ONLY the translated cue text lines, preserving the number of lines.`;
      const r = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [ { role: 'system', content: systemPrompt + `\nTarget Language: ${target}` }, { role: 'user', content: user } ],
        temperature: 0.2
      });
      const content = r.choices[0]?.message?.content?.trim() ?? '';
      translated.push({ index: cue.index, timestamp: cue.timestamp, text: content });
    }
    const out = formatAny(parsed.format, translated);
    outputs.push({ lang: target, content: out });
  }

  const zipName = name.replace(/\.(srt|vtt|ass)$/i, '.translated.zip');
  const zip = await makeZip(outputs.map(o=>({ name: name.replace(/\.(srt|vtt|ass)$/i, `.${o.lang}.$1`), content: o.content })));

  return new Response(zip, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${zipName}"` } });
}
