import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mes = searchParams.get("mes");
  const ano = searchParams.get("ano");

  const orcamentos = await prisma.orcamento.findMany({
    where: mes && ano ? { mes: Number(mes), ano: Number(ano) } : {},
    include: { categoria: true },
    orderBy: { categoria: { nome: "asc" } },
  });

  return NextResponse.json(orcamentos);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const orcamento = await prisma.orcamento.upsert({
    where: { categoriaId_mes_ano: { categoriaId: body.categoriaId, mes: body.mes, ano: body.ano } },
    update: { limite: body.limite },
    create: body,
    include: { categoria: true },
  });
  return NextResponse.json(orcamento, { status: 201 });
}
