import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function calcularPosicao(transacoes: { tipo: string; quantidade: number; valor: number }[]) {
  let quantidade = 0, valorCompras = 0, quantidadeCompras = 0, proventos = 0;
  for (const t of transacoes) {
    if (t.tipo === "compra") {
      quantidade += t.quantidade;
      valorCompras += t.valor;
      quantidadeCompras += t.quantidade;
    } else if (t.tipo === "venda") {
      quantidade -= t.quantidade;
    } else {
      proventos += t.valor;
    }
  }
  const precoMedio = quantidadeCompras > 0 ? valorCompras / quantidadeCompras : 0;
  const valorInvestido = quantidade * precoMedio;
  return { quantidade, precoMedio, valorInvestido, proventos };
}

export async function GET() {
  const ativos = await prisma.ativo.findMany({
    include: { transacoes: { orderBy: { data: "asc" } } },
    orderBy: { ticker: "asc" },
  });

  const resultado = ativos.map((a: typeof ativos[number]) => ({
    ...a,
    posicao: calcularPosicao(a.transacoes),
  }));

  return NextResponse.json(resultado);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const ativo = await prisma.ativo.create({
    data: {
      ticker: body.ticker.toUpperCase(),
      nome: body.nome,
      classe: body.classe,
      indexador: body.indexador || null,
      taxa: body.taxa ? Number(body.taxa) : null,
      vencimento: body.vencimento ? new Date(body.vencimento) : null,
      corretora: body.corretora || null,
    },
  });
  return NextResponse.json(ativo, { status: 201 });
}
