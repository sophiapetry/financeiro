import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx");

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseBRL(valor: string): number {
  if (!valor) return 0;
  return Number(
    valor
      .replace(/R\$\s*/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0;
}

function parseDateBR(data: string): Date {
  const [d, m, a] = data.split("/");
  return new Date(Number(a), Number(m) - 1, Number(d));
}

function parseProduto(produto: string): { ticker: string; nome: string; classe: string } {
  // "CDB - CDB5267KWXO - ITAU UNIBANCO S.A." → renda_fixa
  if (produto.startsWith("CDB -")) {
    const partes = produto.split(" - ");
    const ticker = partes[1]?.trim() ?? produto;
    const nome = partes.slice(2).join(" - ").trim() || ticker;
    return { ticker, nome: `CDB ${nome}`, classe: "renda_fixa" };
  }

  // "GOLD11 - BTG PACTUAL FUTURO DE OURO B3 FUNDO DE ÍNDICE"
  const idx = produto.indexOf(" - ");
  const ticker = idx >= 0 ? produto.slice(0, idx).trim() : produto.trim();
  const nome = idx >= 0 ? produto.slice(idx + 3).trim() : produto.trim();

  const nomeUpper = nome.toUpperCase();
  let classe = "acao";
  if (nomeUpper.includes("FUNDO DE INVESTIMENTO IMOBILI") || nomeUpper.includes(" FII")) {
    classe = "fii";
  } else if (nomeUpper.includes("FUNDO DE ÍNDICE") || nomeUpper.includes("FUNDO DE INDICE") || nomeUpper.includes("ETF")) {
    classe = "etf";
  } else if (ticker.endsWith("34") || ticker.endsWith("35") || ticker.endsWith("32") || ticker.endsWith("33")) {
    classe = "bdr";
  }

  return { ticker, nome, classe };
}

function mapTipo(movimentacao: string, entradaSaida: string): string | null {
  const mov = movimentacao.toUpperCase();
  if (mov === "APLICAÇÃO" || mov === "COMPRA") return "compra";
  if (mov === "RESGATE ANTECIPADO" || mov === "VENDA") return "venda";
  if (mov === "TRANSFERÊNCIA - LIQUIDAÇÃO" || mov === "TRANSFERENCIA - LIQUIDACAO") {
    return entradaSaida.toLowerCase() === "credito" ? "compra" : "venda";
  }
  if (mov === "DIVIDENDO") return "dividendo";
  if (mov === "JUROS SOBRE CAPITAL PRÓPRIO") return "jscp";
  if (mov === "RENDIMENTO") return "rendimento";
  if (mov === "BONIFICAÇÃO EM ATIVOS" || mov === "FRAÇÃO EM ATIVOS" || mov === "LEILÃO DE FRAÇÃO") return "compra";
  if (mov === "DIREITO DE SUBSCRIÇÃO" || mov === "CESSÃO DE DIREITOS") return "compra";
  // ignorados: Direitos de Subscrição - Não Exercido, Cessão de Direitos - Solicitada
  return null;
}

// ─── route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("arquivo") as File | null;
  if (!file) return NextResponse.json({ erro: "Arquivo não enviado" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, string>[];

  let importados = 0;
  let ignorados = 0;
  const erros: string[] = [];

  for (const row of rows) {
    try {
      const entradaSaida = String(row["Entrada/Saída"] ?? "");
      const dataStr = String(row["Data"] ?? "");
      const movimentacao = String(row["Movimentação"] ?? "");
      const produto = String(row["Produto"] ?? "").trim();
      const instituicao = String(row["Instituição"] ?? "").trim();
      const quantidadeStr = String(row["Quantidade"] ?? "0");
      const precoStr = String(row["Preço unitário"] ?? "0");
      const valorStr = String(row["Valor da Operação"] ?? "0");

      if (!produto || !movimentacao || !dataStr) { ignorados++; continue; }

      const tipo = mapTipo(movimentacao, entradaSaida);
      if (!tipo) { ignorados++; continue; }

      const { ticker, nome, classe } = parseProduto(produto);
      const quantidade = parseBRL(quantidadeStr);
      const preco = parseBRL(precoStr);
      const valor = parseBRL(valorStr);
      const data = parseDateBR(dataStr);

      // upsert ativo
      let ativo = await prisma.ativo.findUnique({ where: { ticker } });
      if (!ativo) {
        ativo = await prisma.ativo.create({
          data: { ticker, nome, classe, corretora: instituicao || null },
        });
      }

      await prisma.transacaoInvestimento.create({
        data: {
          ativoId: ativo.id,
          tipo,
          quantidade,
          preco,
          valor,
          taxas: 0,
          data,
        },
      });

      importados++;
    } catch (e) {
      erros.push(String(e));
    }
  }

  return NextResponse.json({ importados, ignorados, erros });
}
