import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

// Mapa das categorias da skill → categorias do sistema
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

function parseBRDate(val: unknown): string | null {
  if (!val) return null;
  const s = String(val).trim();
  // DD/MM/AAAA
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  // Excel serial number
  if (/^\d+$/.test(s)) {
    const d = XLSX.SSF.parse_date_code(Number(s));
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return null;
}

function parseBRMoney(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return Math.abs(val);
  const s = String(val).replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return Math.abs(parseFloat(s) || 0);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ erro: "Arquivo não enviado" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Encontrar linha de cabeçalho (contém "Data" na col A e "Histórico" em alguma coluna)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const row = rows[i] as string[];
    const hasData = row.some((c) => String(c).trim() === "Data");
    const hasHist = row.some((c) => String(c).toLowerCase().includes("histórico") || String(c).toLowerCase().includes("historico"));
    if (hasData && hasHist) { headerIdx = i; break; }
  }
  if (headerIdx === -1) headerIdx = 1;

  const headers = (rows[headerIdx] as string[]).map((h) => String(h).trim().toLowerCase());
  const colIdx = {
    data: headers.findIndex((h) => h === "data"),
    historico: headers.findIndex((h) => h.includes("hist")),
    debito: headers.findIndex((h) => h.includes("déb") || h.includes("deb")),
    credito: headers.findIndex((h) => h.includes("créd") || h.includes("cred")),
    categoria: headers.findIndex((h) => h.includes("categ")),
  };

  // Buscar categorias do banco para mapeamento
  const categorias = await prisma.categoria.findMany({ select: { id: true, nome: true, tipo: true } });

  function resolverCategoria(catSkill: string, tipo: "receita" | "despesa"): number | null {
    const candidatos = MAPA_CATEGORIA[catSkill?.toUpperCase()] ?? [];
    for (const nome of candidatos) {
      const cat = categorias.find((c) => c.nome.toLowerCase() === nome.toLowerCase() && c.tipo === tipo);
      if (cat) return cat.id;
    }
    const fallback = categorias.find((c) => c.tipo === tipo && c.nome.toLowerCase().includes("outro"));
    return fallback?.id ?? categorias.find((c) => c.tipo === tipo)?.id ?? null;
  }

  const transacoes = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const data = parseBRDate(colIdx.data >= 0 ? row[colIdx.data] : row[0]);
    if (!data) continue;

    const historico = String(colIdx.historico >= 0 ? row[colIdx.historico] : row[2] ?? "").trim();
    if (!historico || historico.toLowerCase().includes("saldo") && !historico.includes("SALDO ANTERIOR")) continue;

    const debito = parseBRMoney(colIdx.debito >= 0 ? row[colIdx.debito] : row[4]);
    const credito = parseBRMoney(colIdx.credito >= 0 ? row[colIdx.credito] : row[5]);
    const catSkill = String(colIdx.categoria >= 0 ? row[colIdx.categoria] : row[7] ?? "OUTROS").trim().toUpperCase();

    if (debito === 0 && credito === 0) continue;

    const tipo: "receita" | "despesa" = credito > 0 ? "receita" : "despesa";
    const valor = credito > 0 ? credito : debito;

    transacoes.push({
      data,
      descricao: historico,
      valor,
      tipo,
      categoriaId: resolverCategoria(catSkill, tipo),
      categoriaSkill: catSkill,
    });
  }

  // Metadados do cabeçalho (título na linha 0)
  const titulo = String((rows[0] as string[])?.[0] ?? "");
  const bancoMatch = titulo.match(/—\s*(.+?)\s*\|/);
  const periodoMatch = titulo.match(/Período:\s*(.+?)$/i);

  return NextResponse.json({
    transacoes,
    banco: bancoMatch?.[1]?.trim() ?? null,
    periodo: periodoMatch?.[1]?.trim() ?? null,
    totalLinhas: transacoes.length,
  });
}
