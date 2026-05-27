import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const ativo = await prisma.ativo.update({
    where: { id: Number(id) },
    data: {
      ticker: body.ticker?.toUpperCase(),
      nome: body.nome,
      classe: body.classe,
      indexador: body.indexador || null,
      taxa: body.taxa ? Number(body.taxa) : null,
      vencimento: body.vencimento ? new Date(body.vencimento) : null,
      corretora: body.corretora || null,
    },
  });
  return NextResponse.json(ativo);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.transacaoInvestimento.deleteMany({ where: { ativoId: Number(id) } });
  await prisma.ativo.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
