import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const contas = await prisma.conta.findMany({
    where: { ativo: true },
    include: { transacoes: { select: { valor: true, tipo: true } } },
    orderBy: { nome: "asc" },
  });

  const resultado = contas.map((c) => {
    const receitas = c.transacoes.filter((t) => t.tipo === "receita").reduce((s, t) => s + t.valor, 0);
    const despesas = c.transacoes.filter((t) => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0);
    return {
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      cor: c.cor,
      saldoInicial: c.saldoInicial,
      saldo: c.saldoInicial + receitas - despesas,
      criadoEm: c.criadoEm,
    };
  });

  return NextResponse.json(resultado);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const conta = await prisma.conta.create({ data: body });
  return NextResponse.json(conta, { status: 201 });
}
