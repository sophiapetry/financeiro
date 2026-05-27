import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { inflateSync } from "zlib";
import { prisma } from "@/lib/prisma";

// ─── Extrator de PDF (sem dependências externas, só zlib) ────────────────────

function extractPDFText(buffer: Buffer): string {
  const raw = buffer.toString("binary");
  const items: { x: number; y: number; t: string }[] = [];

  const streamRe = /stream\r?\n/g;
  let sm: RegExpExecArray | null;
  while ((sm = streamRe.exec(raw)) !== null) {
    const dataStart = sm.index + sm[0].length;
    const dataEnd = raw.indexOf("\nendstream", dataStart);
    if (dataEnd < 0) continue;
    const dictStart = raw.lastIndexOf("<<", sm.index);
    const dict = dictStart >= 0 ? raw.slice(dictStart, sm.index) : "";
    if (/DCTDecode|JPXDecode|JBIG2|CCITTFax/.test(dict)) continue;
    const bytes = Buffer.from(raw.slice(dataStart, dataEnd), "binary");
    let decoded = "";
    if (/FlateDecode|\/Fl[\s/>]/.test(dict)) {
      try { decoded = inflateSync(bytes).toString("latin1"); } catch { continue; }
    } else {
      decoded = bytes.toString("latin1");
    }
    parsePDFStream(decoded, items);
  }

  if (!items.length) return "";
  items.sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: string[] = [];
  let ly = items[0].y, line: string[] = [];
  for (const it of items) {
    if (Math.abs(it.y - ly) <= 2) { line.push(it.t); }
    else { if (line.length) lines.push(line.join(" ")); line = [it.t]; ly = it.y; }
  }
  if (line.length) lines.push(line.join(" "));
  return lines.join("\n");
}

function parsePDFStream(s: string, out: { x: number; y: number; t: string }[]) {
  const toks = tokenizePDF(s);
  let x = 0, y = 0;
  const stk: string[] = [];
  for (const tok of toks) {
    if (tok === "Tm" && stk.length >= 6) {
      x = parseFloat(stk[stk.length - 2]); y = parseFloat(stk[stk.length - 1]); stk.length = 0;
    } else if ((tok === "Td" || tok === "TD") && stk.length >= 2) {
      x += parseFloat(stk[stk.length - 2]); y += parseFloat(stk[stk.length - 1]); stk.length = 0;
    } else if (tok === "Tj" || tok === "'" || tok === '"') {
      const t = decodePDFStr(stk.pop() ?? ""); if (t.trim()) out.push({ x, y, t: t.trim() }); stk.length = 0;
    } else if (tok === "TJ") {
      const t = extractTJ(stk.pop() ?? ""); if (t.trim()) out.push({ x, y, t: t.trim() }); stk.length = 0;
    } else {
      stk.push(tok); if (stk.length > 14) stk.shift();
    }
  }
}

function tokenizePDF(s: string): string[] {
  const toks: string[] = []; let i = 0; const n = s.length;
  while (i < n) {
    if (/\s/.test(s[i])) { i++; continue; }
    if (s[i] === "(") {
      let d = 1, j = i + 1;
      while (j < n && d > 0) { if (s[j] === "\\") { j += 2; continue; } if (s[j] === "(") d++; else if (s[j] === ")") d--; j++; }
      toks.push(s.slice(i, j)); i = j;
    } else if (s[i] === "<" && s[i+1] !== "<") {
      const e = s.indexOf(">", i + 1); if (e < 0) { i++; continue; }
      toks.push(s.slice(i, e + 1)); i = e + 1;
    } else if (s[i] === "[") {
      let d = 1, j = i + 1;
      while (j < n && d > 0) { if (s[j] === "[") d++; else if (s[j] === "]") d--; j++; }
      toks.push(s.slice(i, j)); i = j;
    } else {
      let j = i; while (j < n && !/[\s\[\]()<>{}]/.test(s[j])) j++;
      if (j > i) toks.push(s.slice(i, j)); i = Math.max(j, i + 1);
    }
  }
  return toks;
}

function decodePDFStr(tok: string): string {
  if (tok.startsWith("<") && tok.endsWith(">")) {
    const hex = tok.slice(1, -1).replace(/\s/g, "");
    if (/^fe?ff?/i.test(hex)) {
      const buf = Buffer.from(hex.slice(4), "hex");
      const out: string[] = [];
      for (let i = 0; i < buf.length - 1; i += 2) out.push(String.fromCharCode((buf[i] << 8) | buf[i+1]));
      return out.join("");
    }
    return Buffer.from(hex.padEnd(hex.length + hex.length % 2, "0"), "hex").toString("latin1");
  }
  let s = tok.startsWith("(") ? tok.slice(1, -1) : tok;
  return s.replace(/\\n/g, " ").replace(/\\r/g, "").replace(/\\\\/g, "\\")
          .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
          .replace(/\\./g, "");
}

function extractTJ(arr: string): string {
  if (!arr.startsWith("[")) return decodePDFStr(arr);
  const inner = arr.slice(1, -1);
  const parts: string[] = [];
  const re = /\(([^)\\]*(?:\\.[^)\\]*)*)\)|<([0-9a-fA-F\s]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    parts.push(m[1] !== undefined ? decodePDFStr(`(${m[1]})`) : decodePDFStr(`<${m[2]}>`));
  }
  return parts.join("");
}

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
  if (val === null || val === undefined || val === "") return 0;
  // XLSX armazena números como float — usar diretamente
  if (typeof val === "number") return Math.abs(val);
  const s = String(val).replace(/[R$\s]/g, "").trim();
  if (!s || s === "-") return 0;
  // BR com milhares: 1.234,56
  if (/\d\.\d{3},\d/.test(s)) return Math.abs(parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0);
  // US com milhares: 1,234.56
  if (/\d,\d{3}\./.test(s)) return Math.abs(parseFloat(s.replace(/,/g, "")) || 0);
  // BR simples sem milhares: 614,96 — vírgula é decimal
  if (/^-?\d+,\d{1,2}$/.test(s)) return Math.abs(parseFloat(s.replace(",", ".")) || 0);
  // Padrão: 614.96
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
  if (t.includes("itaú") || t.includes("itau") || t.includes("extrato conta / lançamentos") || t.includes("extrato conta / lancamentos")) return "Itaú";
  if (t.includes("banco do brasil") || t.includes("bb.com")) return "Banco do Brasil";
  if (t.includes("caixa econômica") || t.includes("caixa federal") || t.includes("cef") || /\bcaixa\b/.test(t)) return "Caixa";
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

// ─── Parser específico Itaú ──────────────────────────────────────────────────
// Formato: DD/MM/AAAA   LANÇAMENTO   ±VALOR[   ±SALDO]
// Sinal explícito: negativo = despesa, positivo = receita

function parseItau(text: string): TransacaoRaw[] {
  const result: TransacaoRaw[] = [];

  for (const linha of text.split(/\r?\n/)) {
    const m = linha.match(
      /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([-]?\d[\d.]*,\d{2})(?:\s+[-]?\d[\d.]*,\d{2})?$/
    );
    if (!m) continue;

    const [, dateStr, descRaw, valorStr] = m;
    const [d, mo, y] = dateStr.split("/");
    const data = `${y}-${mo}-${d}`;

    const descricao = descRaw.trim();
    if (!descricao || isLinhaDesprezivel(descricao)) continue;

    const valorNum = parseFloat(valorStr.replace(/\./g, "").replace(",", "."));
    if (isNaN(valorNum) || valorNum === 0) continue;

    const valor = Math.abs(valorNum);
    const tipo: "receita" | "despesa" = valorNum < 0 ? "despesa" : "receita";
    result.push({ data, descricao, valor, tipo });
  }

  return result.length ? result : parseGenerico(text);
}

// ─── Parser específico Caixa ─────────────────────────────────────────────────
// Formato: DD/MM/YYYY[ - HH:MM:SS]   NRDOC   HISTORICO   [FAVORECIDO   CPF]   VALOR D/C   SALDO D/C

function parseCaixa(text: string): TransacaoRaw[] {
  const result: TransacaoRaw[] = [];

  for (const linha of text.split(/\r?\n/)) {
    // Linha completa: data [timestamp] nrdoc descrição valor D/C saldo D/C
    const m = linha.match(
      /(\d{2}\/\d{2}\/\d{4})(?:\s*-\s*\d{2}:\d{2}:\d{2})?\s+\d+\s+(.+?)\s+(\d[\d.]*,\d{2})\s+([DC])\s+\d[\d.]*,\d{2}\s+[DC]/i
    );
    if (!m) continue;

    const [, dateStr, descRaw, valorStr, dc] = m;
    const [d, mo, y] = dateStr.split("/");
    const data = `${y}-${mo}-${d}`;

    const descricao = descRaw
      .replace(/\*+[\w./]+\*+/g, "")   // remove CPF/CNPJ mascarados: **990.166/0***
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!descricao || isLinhaDesprezivel(descricao)) continue;

    const valor = parseBRMoney(valorStr);
    if (valor <= 0) continue;

    const tipo: "receita" | "despesa" = dc.toUpperCase() === "C" ? "receita" : "despesa";
    result.push({ data, descricao, valor, tipo });
  }

  return result.length ? result : parseGenerico(text);
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

// ─── Parser OFX ──────────────────────────────────────────────────────────────

function parseOFX(buffer: Buffer): TransacaoRaw[] {
  const text = buffer.toString("latin1");
  const result: TransacaoRaw[] = [];

  // Divide em blocos STMTTRN (suporta SGML sem tags de fechamento e XML)
  const blocos = text.split(/<STMTTRN>/i).slice(1);

  for (const bloco of blocos) {
    const dtRaw = bloco.match(/<DTPOSTED[^>]*>(\d{8,14})/i)?.[1];
    const amtRaw = bloco.match(/<TRNAMT[^>]*>([-+]?[\d.]+)/i)?.[1];
    const memo = (
      bloco.match(/<MEMO[^>]*>([^\r\n<]+)/i)?.[1] ??
      bloco.match(/<NAME[^>]*>([^\r\n<]+)/i)?.[1] ?? ""
    ).trim();
    const trnType = bloco.match(/<TRNTYPE[^>]*>(\w+)/i)?.[1]?.toUpperCase();

    if (!dtRaw || !amtRaw || !memo) continue;

    const y = dtRaw.slice(0, 4);
    const mo = dtRaw.slice(4, 6);
    const d = dtRaw.slice(6, 8);
    const data = `${y}-${mo}-${d}`;

    const amt = parseFloat(amtRaw);
    if (isNaN(amt) || amt === 0) continue;

    const valor = Math.abs(amt);
    const tipo: "receita" | "despesa" =
      amt > 0 || trnType === "CREDIT" ? "receita" : "despesa";

    result.push({ data, descricao: memo, valor, tipo });
  }

  return result;
}

// ─── Parser CSV ───────────────────────────────────────────────────────────────

function parseCSV(buffer: Buffer): TransacaoRaw[] {
  // Tenta UTF-8, senão latin-1 (comum em bancos BR)
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("latin1").decode(buffer);
  }

  // Remove BOM se houver
  text = text.replace(/^﻿/, "");

  const linhas = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length < 2) return [];

  // Detectar separador
  const sep = linhas[0].includes(";") ? ";" : ",";

  // Encontrar linha de cabeçalho (primeira com ≥ 3 colunas)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(linhas.length, 10); i++) {
    if (linhas[i].split(sep).length >= 3) { headerIdx = i; break; }
  }

  const headers = linhas[headerIdx].split(sep).map((h) =>
    h.trim().replace(/^["']|["']$/g, "").toLowerCase()
  );

  const col = {
    data: headers.findIndex((h) => /^data$|^date$|^dt/.test(h)),
    desc: headers.findIndex((h) => /descri|histor|memo|lançam|lancam|estabelec/i.test(h)),
    valor: headers.findIndex((h) => /^valor$|^value$|^amount$|^quantia$/.test(h)),
    debito: headers.findIndex((h) => /débit|debit/i.test(h)),
    credito: headers.findIndex((h) => /crédit|credit/i.test(h)),
    tipo: headers.findIndex((h) => /^tipo$|^type$|natureza/i.test(h)),
  };

  const anoBase = new Date().getFullYear();
  const result: TransacaoRaw[] = [];

  for (let i = headerIdx + 1; i < linhas.length; i++) {
    const cols = linhas[i].split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ""));
    if (cols.length < 2) continue;

    const rawDate = col.data >= 0 ? cols[col.data] : cols[0];
    const data = parseBRDate(rawDate, anoBase);
    if (!data) continue;

    const descricao = (col.desc >= 0 ? cols[col.desc] : cols[1] ?? "").trim();
    if (!descricao || isLinhaDesprezivel(descricao)) continue;

    let valor = 0;
    let tipo: "receita" | "despesa" = "despesa";

    if (col.debito >= 0 && col.credito >= 0) {
      const deb = parseBRMoney(cols[col.debito]);
      const cred = parseBRMoney(cols[col.credito]);
      if (cred > 0) { valor = cred; tipo = "receita"; }
      else { valor = deb; tipo = "despesa"; }
    } else if (col.valor >= 0) {
      const raw = cols[col.valor];
      valor = parseBRMoney(raw);
      const rawNum = parseFloat(raw.replace(/\./g, "").replace(",", "."));
      if (rawNum < 0) tipo = "despesa";
      else if (col.tipo >= 0 && /créd|credit|entrada|c\b/i.test(cols[col.tipo])) tipo = "receita";
      else if (col.tipo >= 0 && /déb|debit|saída|saida|d\b/i.test(cols[col.tipo])) tipo = "despesa";
      else tipo = rawNum >= 0 ? "receita" : "despesa";
    }

    if (valor <= 0) continue;
    result.push({ data, descricao: descricao.replace(/\s+/g, " "), valor, tipo });
  }

  return result;
}

// ─── XLSX (output da skill ou extrato bancário) ──────────────────────────────

function parseXLSX(buffer: Buffer): { transacoes: TransacaoRaw[]; banco: string | null; periodo: string | null } {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  // Procura cabeçalho em até 20 linhas — encontra linha com "data" + coluna de texto/valor
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = (rows[i] as unknown[]).map((c) => String(c).trim().toLowerCase());
    const rowJoined = row.join(" ");
    const temData = row.some((c) => /^data$|^date$/.test(c));
    const temDesc = /descri|histor|tipo|memo|lancam/.test(rowJoined);
    const temValor = /entrada|saida|valor|crédit|débit|credit|debit|amount/.test(rowJoined);
    if (temData && (temDesc || temValor)) { headerIdx = i; break; }
  }
  if (headerIdx === -1) headerIdx = 0;

  const headers = (rows[headerIdx] as unknown[]).map((h) =>
    String(h).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  );

  // Mapeamento flexível de colunas
  const col = {
    data:     headers.findIndex((h) => /^data$|^date$/.test(h)),
    desc:     headers.findIndex((h) => /descri|histor|memo|estabelec/.test(h)),
    tipo:     headers.findIndex((h) => /^tipo$|^type$/.test(h)),
    entradas: headers.findIndex((h) => /entrada|credito|credit|recebido/.test(h)),
    saidas:   headers.findIndex((h) => /saida|debito|debit|pagamento/.test(h)),
    valor:    headers.findIndex((h) => /^valor$|^value$|^amount$/.test(h)),
    categoria:headers.findIndex((h) => /categ/.test(h)),
  };

  const anoBase = new Date().getFullYear();
  const transacoes: TransacaoRaw[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];

    // Data
    const rawDate = String(col.data >= 0 ? row[col.data] : row[0]).trim();
    let data: string | null = parseBRDate(rawDate, anoBase);
    if (!data && /^\d+$/.test(rawDate)) {
      const d = XLSX.SSF.parse_date_code(Number(rawDate));
      if (d) data = `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
    }
    if (!data) continue;

    // Descrição: prefere coluna "Descrição", concatena com "Tipo" se disponível
    let descricao = "";
    if (col.desc >= 0) {
      descricao = String(row[col.desc] ?? "").trim();
      if (col.tipo >= 0 && descricao) {
        const tipoVal = String(row[col.tipo] ?? "").trim();
        if (tipoVal && tipoVal.toLowerCase() !== descricao.toLowerCase()) {
          descricao = `${tipoVal} — ${descricao}`;
        }
      }
    } else if (col.tipo >= 0) {
      descricao = String(row[col.tipo] ?? "").trim();
    } else {
      descricao = String(row[1] ?? row[2] ?? "").trim();
    }

    if (!descricao || isLinhaDesprezivel(descricao)) continue;

    // Valor e tipo
    let valor = 0;
    let tipo: "receita" | "despesa" = "despesa";

    if (col.entradas >= 0 && col.saidas >= 0) {
      const ent = parseBRMoney(row[col.entradas]);
      const sai = parseBRMoney(row[col.saidas]);
      if (ent > 0) { valor = ent; tipo = "receita"; }
      else if (sai > 0) { valor = sai; tipo = "despesa"; }
    } else if (col.valor >= 0) {
      const raw = row[col.valor];
      valor = parseBRMoney(raw);
      const num = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/\./g,"").replace(",","."));
      tipo = num >= 0 ? "receita" : "despesa";
    } else {
      // Fallback: última tentativa com colunas numéricas
      const num4 = parseBRMoney(row[3]);
      const num5 = parseBRMoney(row[4]);
      if (num4 > 0) { valor = num4; tipo = "receita"; }
      else if (num5 > 0) { valor = num5; tipo = "despesa"; }
    }

    if (valor <= 0 || valor > 10_000_000) continue;

    const catSkill = String(col.categoria >= 0 ? row[col.categoria] : "OUTROS").trim().toUpperCase();
    transacoes.push({ data, descricao, valor, tipo, categoriaSkill: catSkill });
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
  try {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ erro: "Arquivo não enviado" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const nome = file.name.toLowerCase();

  let transacoesRaw: TransacaoRaw[] = [];
  let banco: string | null = null;
  let periodo: string | null = null;

  if (nome.endsWith(".pdf")) {
    const text = extractPDFText(buffer);

    if (!text || text.trim().length < 20) {
      return NextResponse.json({
        erro: "O PDF não contém texto legível (possivelmente escaneado). Exporte o extrato no formato OFX ou CSV pelo internet banking.",
      }, { status: 422 });
    }

    banco = detectarBanco(text);
    if (banco === "Nubank") transacoesRaw = parseNubank(text);
    else if (banco === "Caixa") transacoesRaw = parseCaixa(text);
    else if (banco === "Itaú") transacoesRaw = parseItau(text);
    else transacoesRaw = parseGenerico(text);

    // Período: procura no texto padrões como "01/03/2024 a 31/03/2024"
    const periodoMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s*[aà\-–]\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (periodoMatch) periodo = `${periodoMatch[1]} a ${periodoMatch[2]}`;
  } else if (nome.endsWith(".xlsx") || nome.endsWith(".xls")) {
    const parsed = parseXLSX(buffer);
    transacoesRaw = parsed.transacoes;
    banco = parsed.banco;
    periodo = parsed.periodo;
  } else if (nome.endsWith(".ofx") || nome.endsWith(".qfx") || nome.endsWith(".ofc")) {
    transacoesRaw = parseOFX(buffer);
    // Detecta banco pelo texto do OFX/OFC
    const ofxText = buffer.toString("utf-8").toLowerCase().includes("ofxheader")
      ? buffer.toString("utf-8")
      : buffer.toString("latin1");
    banco = detectarBanco(ofxText);
    const periodoMatch = ofxText.match(/DTSTART[^>]*>(\d{8})[\s\S]*?DTEND[^>]*>(\d{8})/i);
    if (periodoMatch) {
      const fmt = (s: string) => `${s.slice(6,8)}/${s.slice(4,6)}/${s.slice(0,4)}`;
      periodo = `${fmt(periodoMatch[1])} a ${fmt(periodoMatch[2])}`;
    }
  } else if (nome.endsWith(".csv") || nome.endsWith(".txt")) {
    transacoesRaw = parseCSV(buffer);
    banco = detectarBanco(buffer.toString("latin1"));
  } else {
    return NextResponse.json({ erro: "Formato não suportado. Envie .pdf, .xlsx, .csv ou .ofx" }, { status: 400 });
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
  } catch (err) {
    console.error("[importar] erro:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ erro: msg || "Erro interno ao processar o arquivo." }, { status: 500 });
  }
}
