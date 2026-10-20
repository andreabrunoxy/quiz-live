// Suoni generati con Web Audio: nessun file da caricare.
let ctx;

// Da chiamare dentro un click (i browser bloccano l'audio finché l'utente non interagisce).
export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
}

function partial(freq, peak, decay, type = 'sine') {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type; osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.connect(g).connect(ctx.destination);
  osc.start(t); osc.stop(t + decay + 0.05);
}

// Tic breve; più acuto negli ultimi secondi
export function tick(urgent = false) {
  if (!ctx) return;
  partial(urgent ? 1500 : 950, 0.25, 0.07, 'square');
}

// Gong: più armoniche non multiple che si spengono lentamente
export function gong() {
  if (!ctx) return;
  [[110, 0.5, 4], [165, 0.3, 3.2], [221, 0.3, 3], [304, 0.18, 2.2], [430, 0.12, 1.6]].forEach(([f, p, d]) => partial(f, p, d));
}
