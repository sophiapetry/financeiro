import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ativoId = searchParams.get("ativoId");

  const where = ativoId ? { ativoId: Number(ativoId) } : {};

  const transacoes = await prisma.transacaoInvestimento.findMany({
    where,
    include: { ativo: true, conta: true },
    orderBy: { data: "desc" },
  });

  return NextResponse.json(transacoes);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const transacao = await prisma.transacaoInvestimento.create({
    data: {
      ativoId: Number(body.ativoId),
      tipo: body.tipo,
      quantidade: Number(body.quantidade) || 0,
      preco: Number(body.preco) || 0,
      valor: Number(body.valor),
      taxas: Number(body.taxas) || 0,
      data: new Date(body.data),
      contaId: body.contaId ? Number(body.contaId) : null,
      observacao: body.observacao || null,
    },
    include: { ativo: true, conta: true },
  });
  return NextResponse.json(transacao, { status: 201 });
}
