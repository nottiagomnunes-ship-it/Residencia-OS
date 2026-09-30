# Residência OS — Fase 7 parte 1 (simulados + metas)
1. Crie um projeto no Supabase e rode `supabase/migrations/0001_init.sql` no SQL Editor.
2. (Dev) Em Authentication → Providers → Email, desative "Confirm email" para entrar direto após o cadastro.
3. `cp .env.example .env.local` e preencha URL e anon key.
4. `npm install && npm run dev` → http://localhost:3000
5. Rode também `supabase/migrations/0002_topics_unique.sql` (necessário para importar o catálogo).
6. Rode `supabase/migrations/0003_adaptive_reviews.sql`. Testes das regras: `npm test`.
7. Rode `supabase/migrations/0004_planned_auto.sql`.
8. Rode `supabase/migrations/0005_simulado_questoes.sql`.
