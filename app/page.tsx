'use client';
import React, { useMemo, useState } from 'react';
import { parseAny } from '@/lib/parse';
import { formatAny } from '@/lib/format';

const ALL_LANGS = ['zh-TW','zh-CN','en','ja','ko','fr','de','es','pt','it','ru','ar','he'];

export default function Page(){
  const [file, setFile] = useState<File|null>(null);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [format, setFormat] = useState<'SRT'|'VTT'|'ASS'|'Unknown'>('Unknown');
  const [targets, setTargets] = useState<string[]>(['en']);
  const [lineWidth, setLineWidth] = useState(42);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string>('');

  const canRun = useMemo(()=> !!text && targets.length>0 && format!=='Unknown', [text, targets, format]);

  async function onFile(f: File){
    const content = await f.text();
    setFile(f); setName(f.name); setText(content);
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext === 'srt') setFormat('SRT'); else if (ext === 'vtt') setFormat('VTT'); else if (ext === 'ass') setFormat('ASS'); else setFormat('Unknown');
  }

  async function run(){
    if (!canRun) return;
    setLoading(true); setLog('Uploading...');
    const res = await fetch('/api/translate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, text, format, targets, lineWidth })
    });
    if (!res.ok) { setLoading(false); setLog('Server error'); return; }
    setLog('Packaging results...');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name.replace(/\.(srt|vtt|ass)$/i, '.translated.zip'); a.click();
    URL.revokeObjectURL(url);
    setLoading(false); setLog('Done.');
  }

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Subtitle Translator (Web)</h1>
        <p className="text-sm opacity-70">Server-side key · safer</p>
      </header>

      <section className="p-4 rounded-2xl border bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <input type="file" accept=".srt,.vtt,.ass" onChange={e=> e.target.files?.[0] && onFile(e.target.files[0])} />
          <span className="text-sm opacity-70 truncate">{name || 'No file selected'}</span>
        </div>
        <p className="text-xs opacity-60 mt-2">Supported: .srt .vtt .ass</p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 p-4 rounded-2xl border bg-white dark:bg-gray-900">
          <h2 className="font-semibold">Preview</h2>
          <pre className="mt-2 h-80 overflow-auto whitespace-pre-wrap text-sm">{text.slice(0, 4000) || 'No content'}</pre>
        </div>
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border bg-white dark:bg-gray-900 space-y-2">
            <label className="block text-sm">Line width
              <input type="number" className="mt-1 w-full px-2 py-1 rounded border bg-transparent" value={lineWidth} onChange={e=>setLineWidth(Number(e.target.value))} />
            </label>
            <div>
              <div className="text-sm mb-1">Targets</div>
              <div className="flex flex-wrap gap-2">
                {ALL_LANGS.map(lang => (
                  <button key={lang}
                    className={`px-2 py-1 rounded border text-sm ${targets.includes(lang)?'bg-brand-600 text-white border-brand-600':'bg-transparent'}`}
                    onClick={()=> setTargets(targets.includes(lang) ? targets.filter(l=>l!==lang) : [...targets, lang])}
                  >{lang}</button>
                ))}
              </div>
            </div>
            <button disabled={!canRun || loading} onClick={run} className="w-full px-3 py-2 rounded bg-brand-600 text-white disabled:opacity-50">{loading? 'Working...' : 'Start translation'}</button>
            {log && <p className="text-xs opacity-60">{log}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}
