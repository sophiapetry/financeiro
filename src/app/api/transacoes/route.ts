import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes");
  const ano = searchParams.get("ano");
  const tipo = searchParams.get("tipo");

  const where: Record<string, unknown> = {};

  if (mes && ano) {
    const inicio = new Date(Number(ano), Number(mes) - 1, 1);
    const fim = new Date(Number(ano), Number(mes), 0, 23, 59, 59);
    where.data = { gte: inicio, lte: fim };
  }

  if (tipo) where.tipo = tipo;

  const transacoes = await prisma.transacao.findMany({
    where,
    include: { categoria: true },
    orderBy: { data: "desc" },
  });

  return NextResponse.json(transacoes);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const transacao = await prisma.transacao.create({
    data: { ...body, data: new Date(body.data) },
    include: { categoria: true },
  });
  return NextResponse.json(transacao, { status: 201 });
}
