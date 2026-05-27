import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx");

function parseBRL(valor: string): number {
  if (!valor) return 0;
  return Number(
    valor.replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", ".").trim()
  ) || 0;
}

function classeFromSheet(sheetName: string): string {
  const n = sheetName.toLowerCase();
  if (n.includes("etf")) return "etf";
  if (n.includes("fii") || n.includes("imobili")) return "fii";
  if (n.includes("renda") || n.includes("cdb") || n.includes("tesouro")) return "renda_fixa";
  if (n.includes("fundo")) return "fundo";
  if (n.includes("bdr")) return "bdr";
  return "acao";
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("arquivo") as File | null;
  if (!file) return NextResponse.json({ erro: "Arquivo não enviado" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });

  let importados = 0;
  const hoje = new Date();

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, string>[];
    const classe = classeFromSheet(sheetName);

    for (const row of rows) {
      const ticker = String(row["Código de Negociação"] ?? "").trim();
      const produto = String(row["Produto"] ?? "").trim();
      const quantidade = Number(String(row["Quantidade"] ?? "0").replace(/\./g, "").replace(",", ".")) || 0;
      const precoStr = String(row["Preço de Fechamento"] ?? "");
      const preco = parseBRL(precoStr);

      if (!ticker || quantidade <= 0) continue;

      // extrai nome do produto: "ITSA4 - ITAUSA S.A." → "ITAUSA S.A."
      const idx = produto.indexOf(" - ");
      const nome = idx >= 0 ? produto.slice(idx + 3).trim() : produto;

      const valor = quantidade * preco;

      // upsert ativo
      let ativo = await prisma.ativo.findUnique({ where: { ticker } });
      if (!ativo) {
        ativo = await prisma.ativo.create({ data: { ticker, nome, classe } });
      }

      // substitui todas as transações do ativo por um snapshot atual
      await prisma.transacaoInvestimento.deleteMany({ where: { ativoId: ativo.id } });
      await prisma.transacaoInvestimento.create({
        data: { ativoId: ativo.id, tipo: "compra", quantidade, preco, valor, taxas: 0, data: hoje },
      });

      importados++;
    }
  }

  return NextResponse.json({ importados });
}
