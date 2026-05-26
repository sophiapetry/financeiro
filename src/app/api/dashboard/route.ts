import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mes = Number(searchParams.get("mes") || new Date().getMonth() + 1);
  const ano = Number(searchParams.get("ano") || new Date().getFullYear());

  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59);

  const [transacoes, orcamentos, contas] = await Promise.all([
    prisma.transacao.findMany({
      where: { data: { gte: inicio, lte: fim } },
      include: { categoria: true },
    }),
    prisma.orcamento.findMany({
      where: { mes, ano },
      include: { categoria: true },
    }),
    prisma.conta.findMany({
      where: { ativo: true },
      include: { transacoes: { select: { valor: true, tipo: true } } },
      orderBy: { nome: "asc" },
    }),
  ]);

  const totalReceitas = transacoes
    .filter((t) => t.tipo === "receita")
    .reduce((s, t) => s + t.valor, 0);

  const totalDespesas = transacoes
    .filter((t) => t.tipo === "despesa")
    .reduce((s, t) => s + t.valor, 0);

  const saldo = totalReceitas - totalDespesas;

  // Gastos por categoria
  const gastosPorCategoria: Record<number, { nome: string; cor: string; total: number }> = {};
  transacoes
    .filter((t) => t.tipo === "despesa")
    .forEach((t) => {
      if (!gastosPorCategoria[t.categoriaId]) {
        gastosPorCategoria[t.categoriaId] = {
          nome: t.categoria.nome,
          cor: t.categoria.cor,
          total: 0,
        };
      }
      gastosPorCategoria[t.categoriaId].total += t.valor;
    });

  // Evolução dos últimos 6 meses
  const evolucao = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ano, mes - 1 - i, 1);
    const m = d.getMonth() + 1;
    const a = d.getFullYear();
    const ini = new Date(a, m - 1, 1);
    const fim2 = new Date(a, m, 0, 23, 59, 59);
    const ts = await prisma.transacao.findMany({ where: { data: { gte: ini, lte: fim2 } } });
    evolucao.push({
      mes: `${m.toString().padStart(2, "0")}/${a}`,
      receitas: ts.filter((t) => t.tipo === "receita").reduce((s, t) => s + t.valor, 0),
      despesas: ts.filter((t) => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0),
    });
  }

  // Progresso do orçamento
  const progressoOrcamento = orcamentos.map((o) => {
    const gasto = gastosPorCategoria[o.categoriaId]?.total || 0;
    return {
      categoria: o.categoria.nome,
      cor: o.categoria.cor,
      limite: o.limite,
      gasto,
      percentual: Math.round((gasto / o.limite) * 100),
    };
  });

  const saldoPorConta = contas.map((c) => {
    const rec = c.transacoes.filter((t) => t.tipo === "receita").reduce((s, t) => s + t.valor, 0);
    const desp = c.transacoes.filter((t) => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0);
    return { id: c.id, nome: c.nome, cor: c.cor, saldo: c.saldoInicial + rec - desp };
  });

  return NextResponse.json({
    totalReceitas,
    totalDespesas,
    saldo,
    gastosPorCategoria: Object.values(gastosPorCategoria),
    evolucao,
    progressoOrcamento,
    ultimasTransacoes: transacoes.slice(0, 5),
    saldoPorConta,
  });
}
