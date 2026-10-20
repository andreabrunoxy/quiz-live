'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { QUESTIONS as DEFAULT_Q, TIME_LIMIT as DEFAULT_T } from '@/lib/questions';

const blank = () => ({ text: '', options: ['', '', '', ''], correct: 0 });
const MAX = 20;

export default function Editor() {
  const [qs, setQs] = useState(null);
  const [time, setTime] = useState(DEFAULT_T);
  const [msg, setMsg] = useState({ text: '', ok: false });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('quiz_config').select('*').eq('id', 1).maybeSingle();
      setQs(data?.questions?.length ? data.questions : DEFAULT_Q.map((q) => ({ ...q, options: [...q.options] })));
      if (data) setTime(data.time_limit);
    })();
  }, []);

  if (!qs) return <main><p>Caricamento…</p></main>;

  const upd = (i, patch) => setQs(qs.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const setOpt = (i, j, v) => upd(i, { options: qs[i].options.map((o, k) => (k === j ? v : o)) });

  async function save() {
    const bad = qs.findIndex((q) => !q.text.trim() || q.options.some((o) => !o.trim()));
    if (bad >= 0) return setMsg({ text: `Domanda ${bad + 1}: compila il testo e tutte e 4 le risposte.`, ok: false });
    const t = Math.min(120, Math.max(5, Number(time) || 30));
    const { error } = await supabase.from('quiz_config').upsert({ id: 1, questions: qs, time_limit: t });
    setTime(t);
    setMsg(error ? { text: error.message, ok: false } : { text: 'Salvato. Vale per le prossime partite che crei.', ok: true });
  }

  return (
    <main>
      <h1>Editor domande</h1>
      <label>Secondi per rispondere{' '}
        <input type="number" min={5} max={120} value={time} onChange={(e) => setTime(e.target.value)} style={{ width: 90 }} />
      </label>
      {qs.map((q, i) => (
        <section className="card" key={i}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>Domanda {i + 1}</b>
            <button className="ghost" onClick={() => setQs(qs.filter((_, k) => k !== i))} disabled={qs.length <= 1}>Elimina</button>
          </div>
          <input type="text" value={q.text} placeholder="Testo della domanda" aria-label={`Domanda ${i + 1}`} onChange={(e) => upd(i, { text: e.target.value })} />
          {q.options.map((o, j) => (
            <div className="optrow" key={j}>
              <input type="radio" name={`c${i}`} checked={q.correct === j} onChange={() => upd(i, { correct: j })} aria-label={`Risposta ${j + 1} corretta`} />
              <input type="text" value={o} placeholder={`Risposta ${j + 1}`} onChange={(e) => setOpt(i, j, e.target.value)} />
            </div>
          ))}
          <p className="muted" style={{ margin: '6px 0 0' }}>Il pallino indica la risposta giusta.</p>
        </section>
      ))}
      <div className="row">
        <button className="ghost" disabled={qs.length >= MAX} onClick={() => setQs([...qs, blank()])}>Aggiungi domanda</button>
        <button onClick={save}>Salva</button>
        <a href="/host"><button className="ghost">Vai alla console</button></a>
      </div>
      {msg.text && <p className={msg.ok ? 'ok' : 'err'}>{msg.text}</p>}
    </main>
  );
}
