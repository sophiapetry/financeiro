# Financeiro Pessoal — S Petry

Sistema de gestão financeira pessoal para **Sophia Ferreira Petry**.

## Stack

- Next.js 16 (App Router + Turbopack)
- Prisma 7 + SQLite (`prisma/financeiro.db`)
- Tailwind CSS v4
- TypeScript
- Recharts (gráficos)

## Iniciar

```bash
npm run dev        # http://localhost:3000
npm run seed       # popular categorias iniciais
npx prisma migrate dev  # aplicar mudanças no schema
```

## Módulos

### Dashboard
- Cards: receitas, despesas e saldo do mês
- Gráfico de barras: evolução dos últimos 6 meses
- Pizza: despesas por categoria
- Progresso do orçamento por categoria
- Últimas 5 transações do mês

### Transações
- Lançamento de receitas e despesas
- Filtro por mês/ano e busca por descrição ou categoria
- Edição e exclusão inline
- Campo de observação opcional

### Relatórios
- Totais de receitas, despesas e resultado do mês
- Gráfico de barras por dia do mês
- Pizza e ranking de despesas por categoria com percentuais

### Orçamento
- Definição de limite por categoria por mês
- Barra de progresso: verde (< 80%), amarelo (80–100%), vermelho (> 100%)
- Alerta visual quando limite extrapolado

### Categorias
- CRUD de categorias de receita e despesa
- Seletor de cor (10 opções)
- 12 categorias pré-cadastradas no seed

## Regras de exibição

- Valores em `R$ 0.000,00` (Intl.NumberFormat pt-BR)
- Datas em `DD/MM/AAAA`
- Tipo de transação: `"receita"` (verde) | `"despesa"` (vermelho)

## Deploy (opcional)

Atualmente roda apenas em localhost com SQLite.
Para deploy na Vercel: migrar banco para **Neon (PostgreSQL)** — trocar `provider = "sqlite"` por `"postgresql"` no schema e atualizar `prisma.config.ts` com a connection string do Neon.

## Git

Commits em português com mensagens descritivas.
Repositório: https://github.com/sophiapetry/financeiro
