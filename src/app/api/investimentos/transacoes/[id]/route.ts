import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const transacao = await prisma.transacaoInvestimento.update({
    where: { id: Number(id) },
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
  return NextResponse.json(transacao);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.transacaoInvestimento.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
