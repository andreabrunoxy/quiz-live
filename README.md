# Quiz Live

Next.js + Supabase. Il pubblico entra da QR code, risponde in 30 secondi, classifica per punti e velocità.

## 1. Supabase (gratuito)
1. Crea un progetto su https://supabase.com
2. SQL Editor → incolla `supabase.sql` → Run
3. Project Settings → API: copia **Project URL** e **anon public key**

## 2. In locale (VS Code)
```
npm install
cp .env.example .env.local   # incolla URL e anon key
npm run dev
```
Apri http://localhost:3000/host. Per provare dal telefono usa la rete locale o il sito già deployato.

## 3. GitHub + Netlify
1. `git init`, commit e push su un repo GitHub
2. Netlify → Add new site → Import from Git → scegli il repo (rileva Next.js da solo)
3. Site settings → Environment variables: aggiungi `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`, poi rifai il deploy

## Uso
- `/host`: crea la partita, mostra QR, avvia le domande (proietta questa pagina)
- Domande: modifica `lib/questions.js`
- Punteggio: da 1000 (risposta immediata) a 500 (a 30s), 0 se sbagliata; parità → tempo totale minore
