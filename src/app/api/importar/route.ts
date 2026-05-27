import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface TransacaoRaw {
  data: string;          // YYYY-MM-DD
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  categoriaSkill?: string;
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function parseBRMoney(val: unknown): number {
  if (!val) return 0;
  const s = String(val).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return Math.abs(parseFloat(s) || 0);
}

function parseBRDate(s: string, anoBase: number): string | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return null;
  const d = m[1].padStart(2, "0");
  const mo = m[2].padStart(2, "0");
  const y = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : String(anoBase);
  return `${y}-${mo}-${d}`;
}

// Extrai todas as datas BR encontradas num texto → toma o ano mais frequente
function inferirAnoPDF(text: string): number {
  const anos = [...text.matchAll(/\d{2}\/\d{2}\/(\d{4})/g)].map((m) => Number(m[1]));
  if (!anos.length) return new Date().getFullYear();
  return Number(Object.entries(
    anos.reduce<Record<number, number>>((acc, a) => { acc[a] = (acc[a] || 0) + 1; return acc; }, {})
  ).sort((a, b) => b[1] - a[1])[0][0]);
}

function detectarBanco(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("nubank")) return "Nubank";
  if (t.includes("itaú") || t.includes("itau")) return "Itaú";
  if (t.includes("banco do brasil") || t.includes("bb.com")) return "Banco do Brasil";
  if (t.includes("caixa econômica") || t.includes("caixa federal") || t.includes("cef")) return "Caixa";
  if (t.includes("banrisul")) return "Banrisul";
  if (t.includes("picpay")) return "PicPay";
  if (t.includes("pagseguro")) return "PagSeguro";
  return "Desconhecido";
}

function isLinhaDesprezivel(descricao: string): boolean {
  return /^(saldo|subtotal|total|período|periodo|agência|conta|extrato|cliente|cpf|cnpj|data|histórico|historico|documento|débito|debito|crédito|credito|valor|pag\.|pág\.)/i
    .test(descricao.trim());
}

// ─── Parser genérico (funciona para a maioria dos bancos brasileiros) ──────────

function parseGenerico(text: string): TransacaoRaw[] {
  const anoBase = inferirAnoPDF(text);
  const linhas = text.split(/\r?\n/);
  const result: TransacaoRaw[] = [];

  for (const linha of linhas) {
    // Procura data no início ou meio da linha
    const dateMatch = linha.match(/\b(\d{2}\/\d{2}(?:\/(?:\d{2}|\d{4}))?)\b/);
    if (!dateMatch) continue;

    const data = parseBRDate(dateMatch[1], anoBase);
    if (!data) continue;

    // Extrai todos os valores monetários da linha
    const valores = [...linha.matchAll(/\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/g)];
    if (!valores.length) continue;

    // Descrição: texto entre a data e o primeiro valor
    const dateEnd = (dateMatch.index ?? 0) + dateMatch[0].length;
    const firstValueStart = valores[0].index ?? 0;
    const descricao = linha.slice(dateEnd, firstValueStart).replace(/\s+/g, " ").trim();

    if (!descricao || descricao.length < 3 || isLinhaDesprezivel(descricao)) continue;

    // Valor: prefere o primeiro valor após a descrição; se houver dois, o primeiro é a transação
    const valor = parseBRMoney(valores[0][1]);
    if (valor <= 0 || valor > 1_000_000) continue;

    // Determina tipo: indicadores D/C, sinal, ou palavras-chave na descrição
    const sufixo = linha.slice((valores[0].index ?? 0) + valores[0][0].length, (valores[0].index ?? 0) + valores[0][0].length + 4);
    const isC = /\bC\b/i.test(sufixo);
    const isD = /\bD\b/i.test(sufixo);
    const temMenos = /[-−]/.test(linha.slice(0, (valores[0].index ?? 0)));

    let tipo: "receita" | "despesa";
    if (isC) tipo = "receita";
    else if (isD) tipo = "despesa";
    else if (/crédito|credito|salário|salario|recebido|receb\.|cashback|rendimento|restituição/i.test(descricao)) tipo = "receita";
    else tipo = "despesa";

    // Se tem sinal negativo explícito antes do valor, é saída independente
    if (temMenos && tipo === "receita" && !isC) tipo = "despesa";

    result.push({ data, descricao, valor, tipo });
  }

  return result;
}

// ─── Parser específico Nubank (extrato CSV/texto) ────────────────────────────

function parseNubank(text: string): TransacaoRaw[] {
  const anoBase = inferirAnoPDF(text);
  const linhas = text.split(/\r?\n/);
  const result: TransacaoRaw[] = [];

  for (const linha of linhas) {
    // Nubank: "15 mar 2024   Supermercado X   -150,00" ou "DD/MM/AAAA descrição valor"
    const m1 = linha.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-+]?\d{1,3}(?:\.\d{3})*,\d{2})$/);
    const m2 = linha.match(/^(\d{2}\s+\w{3}(?:\s+\d{4})?)\s+(.+?)\s+([-+]?[\d.,]+)$/);

    let data: string | null = null;
    let descricao = "";
    let valorRaw = "";

    if (m1) { data = parseBRDate(m1[1], anoBase); descricao = m1[2]; valorRaw = m1[3]; }
    else if (m2) {
      // "15 mar 2024" → converter
      const meses: Record<string, string> = { jan:"01",fev:"02",mar:"03",abr:"04",mai:"05",jun:"06",jul:"07",ago:"08",set:"09",out:"10",nov:"11",dez:"12" };
      const pm = m2[1].match(/^(\d{2})\s+(\w{3})(?:\s+(\d{4}))?$/);
      if (pm) {
        const y = pm[3] ?? String(anoBase);
        const mo = meses[pm[2].toLowerCase()] ?? "01";
        data = `${y}-${mo}-${pm[1]}`;
      }
      descricao = m2[2];
      valorRaw = m2[3];
    }

    if (!data || !descricao || isLinhaDesprezivel(descricao)) continue;

    const valorNum = parseFloat(valorRaw.replace(/\./g, "").replace(",", "."));
    if (isNaN(valorNum) || valorNum === 0) continue;

    result.push({
      data,
      descricao: descricao.trim(),
      valor: Math.abs(valorNum),
      tipo: valorNum < 0 ? "despesa" : "receita",
    });
  }

  // Fallback para genérico se não extraiu nada
  return result.length ? result : parseGenerico(text);
}

// ─── Mapa skill → categoria do sistema ───────────────────────────────────────

const MAPA_CATEGORIA: Record<string, string[]> = {
  SALÁRIO: ["Salário", "Freelance"],
  TRANSFERÊNCIA: ["Outros (Receita)", "Outros (Despesa)"],
  TARIFA: ["Outros (Despesa)"],
  "JUROS/ENCARGOS": ["Outros (Despesa)"],
  TRIBUTO: ["Outros (Despesa)"],
  EMPRÉSTIMO: ["Outros (Despesa)"],
  "APLICAÇÃO/RESGATE": ["Investimentos", "Outros (Receita)"],
  PAGAMENTO: ["Outros (Despesa)"],
  FGTS: ["Salário", "Outros (Receita)"],
  ESTORNO: ["Outros (Receita)"],
  CHEQUE: ["Outros (Despesa)"],
  SAQUE: ["Outros (Despesa)"],
  OUTROS: ["Outros (Despesa)", "Outros (Receita)"],
};

// ─── XLSX (output da skill) ───────────────────────────────────────────────────

function parseXLSX(buffer: Buffer): { transacoes: TransacaoRaw[]; banco: string | null; periodo: string | null } {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  let headerIdx = 1;
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const row = rows[i] as string[];
    if (row.some((c) => String(c).trim() === "Data") && row.some((c) => /hist/i.test(String(c)))) {
      headerIdx = i; break;
    }
  }

  const headers = (rows[headerIdx] as string[]).map((h) => String(h).trim().toLowerCase());
  const col = {
    data: headers.findIndex((h) => h === "data"),
    historico: headers.findIndex((h) => h.includes("hist")),
    debito: headers.findIndex((h) => h.includes("déb") || h.includes("deb")),
    credito: headers.findIndex((h) => h.includes("créd") || h.includes("cred")),
    categoria: headers.findIndex((h) => h.includes("categ")),
  };

  const anoBase = new Date().getFullYear();
  const transacoes: TransacaoRaw[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const rawDate = String(col.data >= 0 ? row[col.data] : row[0]).trim();
    const data = parseBRDate(rawDate, anoBase) ??
      (/^\d+$/.test(rawDate) ? (() => { const d = XLSX.SSF.parse_date_code(Number(rawDate)); return d ? `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}` : null; })() : null);
    if (!data) continue;

    const descricao = String(col.historico >= 0 ? row[col.historico] : row[2] ?? "").trim();
    if (!descricao || isLinhaDesprezivel(descricao)) continue;

    const debito = parseBRMoney(col.debito >= 0 ? row[col.debito] : row[4]);
    const credito = parseBRMoney(col.credito >= 0 ? row[col.credito] : row[5]);
    if (debito === 0 && credito === 0) continue;

    const catSkill = String(col.categoria >= 0 ? row[col.categoria] : row[7] ?? "OUTROS").trim().toUpperCase();
    const tipo: "receita" | "despesa" = credito > 0 ? "receita" : "despesa";
    transacoes.push({ data, descricao, valor: credito > 0 ? credito : debito, tipo, categoriaSkill: catSkill });
  }

  const titulo = String((rows[0] as string[])?.[0] ?? "");
  return {
    transacoes,
    banco: titulo.match(/—\s*(.+?)\s*\|/)?.[1]?.trim() ?? null,
    periodo: titulo.match(/Período:\s*(.+?)$/i)?.[1]?.trim() ?? null,
  };
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ erro: "Arquivo não enviado" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const nome = file.name.toLowerCase();

  let transacoesRaw: TransacaoRaw[] = [];
  let banco: string | null = null;
  let periodo: string | null = null;

  if (nome.endsWith(".pdf")) {
    // Dynamic import — pdf-parse exporta a função diretamente no ESM
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import("pdf-parse") as any;
    const pdfParse: (buf: Buffer) => Promise<{ text: string }> = mod.default ?? mod;
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    banco = detectarBanco(text);
    transacoesRaw = banco === "Nubank" ? parseNubank(text) : parseGenerico(text);

    // Período: procura no texto padrões como "01/03/2024 a 31/03/2024"
    const periodoMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s*[aà\-–]\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (periodoMatch) periodo = `${periodoMatch[1]} a ${periodoMatch[2]}`;
  } else if (nome.endsWith(".xlsx") || nome.endsWith(".xls")) {
    const parsed = parseXLSX(buffer);
    transacoesRaw = parsed.transacoes;
    banco = parsed.banco;
    periodo = parsed.periodo;
  } else {
    return NextResponse.json({ erro: "Formato não suportado. Envie um .pdf ou .xlsx" }, { status: 400 });
  }

  // Resolver categorias
  const categorias = await prisma.categoria.findMany({ select: { id: true, nome: true, tipo: true } });

  function resolverCategoria(catSkill: string | undefined, tipo: "receita" | "despesa"): number | null {
    const candidatos = MAPA_CATEGORIA[catSkill?.toUpperCase() ?? ""] ?? [];
    for (const nome of candidatos) {
      const cat = categorias.find((c) => c.nome.toLowerCase() === nome.toLowerCase() && c.tipo === tipo);
      if (cat) return cat.id;
    }
    return categorias.find((c) => c.tipo === tipo && c.nome.toLowerCase().includes("outro"))?.id
      ?? categorias.find((c) => c.tipo === tipo)?.id
      ?? null;
  }

  const transacoes = transacoesRaw.map((t) => ({
    ...t,
    categoriaId: resolverCategoria(t.categoriaSkill, t.tipo),
    categoriaSkill: t.categoriaSkill ?? "OUTROS",
  }));

  return NextResponse.json({ transacoes, banco, periodo, totalLinhas: transacoes.length });
}
