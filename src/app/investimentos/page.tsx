"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Plus, Pencil, Trash2, X, TrendingUp, TrendingDown,
  RefreshCw, DollarSign, BarChart2, Percent, Lock, Upload,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { formatCurrency, formatDate } from "@/lib/formatters";

// ─── tipos ────────────────────────────────────────────────────────────────────

interface Posicao {
  quantidade: number;
  precoMedio: number;
  valorInvestido: number;
  proventos: number;
}

interface Ativo {
  id: number;
  ticker: string;
  nome: string;
  classe: string;
  indexador: string | null;
  taxa: number | null;
  vencimento: string | null;
  corretora: string | null;
  posicao: Posicao;
}

interface TransacaoInv {
  id: number;
  ativoId: number;
  ativo: { ticker: string; nome: string };
  tipo: string;
  quantidade: number;
  preco: number;
  valor: number;
  taxas: number;
  data: string;
  conta: { nome: string } | null;
  observacao: string | null;
}

interface Cotacao {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
}

interface Conta {
  id: number;
  nome: string;
}

// ─── constantes ───────────────────────────────────────────────────────────────

const CLASSES: Record<string, { label: string; cor: string; variavel: boolean }> = {
  acao:       { label: "Ação",         cor: "#6366f1", variavel: true  },
  fii:        { label: "FII",          cor: "#22c55e", variavel: true  },
  etf:        { label: "ETF",          cor: "#3b82f6", variavel: true  },
  bdr:        { label: "BDR",          cor: "#f59e0b", variavel: true  },
  renda_fixa: { label: "Renda Fixa",   cor: "#8b5cf6", variavel: false },
  fundo:      { label: "Fundo",        cor: "#ec4899", variavel: false },
};

const TIPOS_TRANSACAO: Record<string, string> = {
  compra:       "Compra",
  venda:        "Venda",
  dividendo:    "Dividendo",
  jscp:         "JCP",
  rendimento:   "Rendimento",
  amortizacao:  "Amortização",
};

const VAZIO_ATIVO = { ticker: "", nome: "", classe: "acao", indexador: "", taxa: "", vencimento: "", corretora: "" };
const hoje = new Date().toISOString().slice(0, 10);
const VAZIO_TRANSACAO = { ativoId: "", tipo: "compra", quantidade: "", preco: "", valor: "", taxas: "0", data: hoje, contaId: "", observacao: "" };

// ─── componente ───────────────────────────────────────────────────────────────

export default function InvestimentosPage() {
  const [aba, setAba] = useState<"portfolio" | "lancamentos">("portfolio");
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [transacoes, setTransacoes] = useState<TransacaoInv[]>([]);
  const [cotacoes, setCotacoes] = useState<Record<string, Cotacao>>({});
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizandoCotacoes, setAtualizandoCotacoes] = useState(false);

  const [importando, setImportando] = useState(false);

  const [modalAtivo, setModalAtivo] = useState(false);
  const [modalTransacao, setModalTransacao] = useState(false);
  const [editandoAtivo, setEditandoAtivo] = useState<number | null>(null);
  const [editandoTransacao, setEditandoTransacao] = useState<number | null>(null);
  const [formAtivo, setFormAtivo] = useState(VAZIO_ATIVO);
  const [formTransacao, setFormTransacao] = useState(VAZIO_TRANSACAO);

  // ─── carregamento ──────────────────────────────────────────────────────────

  const carregarAtivos = useCallback(async () => {
    const data = await fetch("/api/investimentos").then((r) => r.json());
    setAtivos(data);
    return data as Ativo[];
  }, []);

  const carregarTransacoes = useCallback(async () => {
    const data = await fetch("/api/investimentos/transacoes").then((r) => r.json());
    setTransacoes(data);
  }, []);

  const buscarCotacoes = useCallback(async (lista: Ativo[]) => {
    const variaveis = lista.filter((a) => CLASSES[a.classe]?.variavel && a.posicao.quantidade > 0);
    if (variaveis.length === 0) return;
    setAtualizandoCotacoes(true);
    try {
      const tickers = variaveis.map((a) => a.ticker).join(",");
      const data: Cotacao[] = await fetch(`/api/investimentos/cotacoes?tickers=${tickers}`).then((r) => r.json());
      const mapa: Record<string, Cotacao> = {};
      for (const c of data) mapa[c.symbol] = c;
      setCotacoes(mapa);
    } finally {
      setAtualizandoCotacoes(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      carregarAtivos(),
      carregarTransacoes(),
      fetch("/api/contas").then((r) => r.json()),
    ]).then(([lista, , cs]) => {
      setContas(cs);
      setCarregando(false);
      buscarCotacoes(lista);
    });
  }, [carregarAtivos, carregarTransacoes, buscarCotacoes]);

  // ─── cálculos de portfólio ─────────────────────────────────────────────────

  function precoAtual(a: Ativo): number | null {
    const cot = cotacoes[a.ticker];
    return cot ? cot.regularMarketPrice : null;
  }

  function valorAtual(a: Ativo): number {
    const preco = precoAtual(a);
    if (preco !== null) return a.posicao.quantidade * preco;
    return a.posicao.valorInvestido; // fallback: valor investido
  }

  function rendimentoTotal(a: Ativo): number {
    return (valorAtual(a) - a.posicao.valorInvestido) + a.posicao.proventos;
  }

  const ativosComPosicao = ativos.filter((a) => a.posicao.quantidade > 0);

  const totalInvestido = ativosComPosicao.reduce((s, a) => s + a.posicao.valorInvestido, 0);
  const totalAtual = ativosComPosicao.reduce((s, a) => s + valorAtual(a), 0);
  const totalProventos = ativosComPosicao.reduce((s, a) => s + a.posicao.proventos, 0);
  const totalRendimento = totalAtual - totalInvestido + totalProventos;
  const pctRendimento = totalInvestido > 0 ? (totalRendimento / totalInvestido) * 100 : 0;

  // dados do gráfico: alocação por classe
  const alocacaoPorClasse = Object.entries(
    ativosComPosicao.reduce<Record<string, number>>((acc, a) => {
      acc[a.classe] = (acc[a.classe] ?? 0) + valorAtual(a);
      return acc;
    }, {})
  ).map(([classe, valor]) => ({ name: CLASSES[classe]?.label ?? classe, value: valor, cor: CLASSES[classe]?.cor ?? "#888" }));

  // ─── importar B3 ──────────────────────────────────────────────────────────

  async function importarB3(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    try {
      const form = new FormData();
      form.append("arquivo", file);
      const res = await fetch("/api/investimentos/importar", { method: "POST", body: form });
      const { importados, ignorados } = await res.json();
      alert(`Importação concluída!\n${importados} lançamentos importados\n${ignorados} linhas ignoradas`);
      const lista = await carregarAtivos();
      await carregarTransacoes();
      buscarCotacoes(lista);
    } finally {
      setImportando(false);
      e.target.value = "";
    }
  }

  // ─── ações sobre ativos ────────────────────────────────────────────────────

  function abrirModalAtivo(a?: Ativo) {
    if (a) {
      setFormAtivo({
        ticker: a.ticker, nome: a.nome, classe: a.classe,
        indexador: a.indexador ?? "", taxa: String(a.taxa ?? ""),
        vencimento: a.vencimento ? a.vencimento.slice(0, 10) : "",
        corretora: a.corretora ?? "",
      });
      setEditandoAtivo(a.id);
    } else {
      setFormAtivo(VAZIO_ATIVO);
      setEditandoAtivo(null);
    }
    setModalAtivo(true);
  }

  async function salvarAtivo(e: React.FormEvent) {
    e.preventDefault();
    const url = editandoAtivo ? `/api/investimentos/${editandoAtivo}` : "/api/investimentos";
    await fetch(url, { method: editandoAtivo ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formAtivo) });
    setModalAtivo(false);
    const lista = await carregarAtivos();
    buscarCotacoes(lista);
  }

  async function excluirAtivo(id: number) {
    if (!confirm("Excluir este ativo e todos os seus lançamentos?")) return;
    await fetch(`/api/investimentos/${id}`, { method: "DELETE" });
    const lista = await carregarAtivos();
    await carregarTransacoes();
    buscarCotacoes(lista);
  }

  // ─── ações sobre transações ────────────────────────────────────────────────

  function abrirModalTransacao(t?: TransacaoInv) {
    if (t) {
      setFormTransacao({
        ativoId: String(t.ativoId), tipo: t.tipo,
        quantidade: String(t.quantidade), preco: String(t.preco),
        valor: String(t.valor), taxas: String(t.taxas),
        data: t.data.slice(0, 10),
        contaId: t.conta ? String((t.conta as { id?: number } & { nome: string }).id ?? "") : "",
        observacao: t.observacao ?? "",
      });
      setEditandoTransacao(t.id);
    } else {
      setFormTransacao(VAZIO_TRANSACAO);
      setEditandoTransacao(null);
    }
    setModalTransacao(true);
  }

  async function salvarTransacao(e: React.FormEvent) {
    e.preventDefault();
    const url = editandoTransacao ? `/api/investimentos/transacoes/${editandoTransacao}` : "/api/investimentos/transacoes";
    await fetch(url, { method: editandoTransacao ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formTransacao) });
    setModalTransacao(false);
    const lista = await carregarAtivos();
    await carregarTransacoes();
    buscarCotacoes(lista);
  }

  async function excluirTransacao(id: number) {
    if (!confirm("Excluir este lançamento?")) return;
    await fetch(`/api/investimentos/transacoes/${id}`, { method: "DELETE" });
    const lista = await carregarAtivos();
    await carregarTransacoes();
    buscarCotacoes(lista);
  }

  // calcula valor automaticamente na compra/venda
  function handleQtdPreco(campo: "quantidade" | "preco", val: string) {
    const atualizado = { ...formTransacao, [campo]: val };
    const qty = Number(atualizado.quantidade);
    const prc = Number(atualizado.preco);
    if (qty > 0 && prc > 0 && ["compra", "venda"].includes(atualizado.tipo)) {
      atualizado.valor = String(qty * prc);
    }
    setFormTransacao(atualizado);
  }

  // ─── render ────────────────────────────────────────────────────────────────

  function renderLabel(props: { name?: string; percent?: number }) {
    return `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`;
  }

  if (carregando) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>;
  }

  return (
    <div className="space-y-5">
      {/* cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Investimentos</h1>
        <div className="flex gap-2">
          <label className={`flex items-center gap-2 border px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 cursor-pointer ${importando ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload size={15} />
            {importando ? "Importando..." : "Importar B3 (XLSX)"}
            <input type="file" accept=".xlsx" className="hidden" onChange={importarB3} disabled={importando} />
          </label>
          <button
            onClick={() => buscarCotacoes(ativos)}
            disabled={atualizandoCotacoes}
            className="flex items-center gap-2 border px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={15} className={atualizandoCotacoes ? "animate-spin" : ""} />
            Atualizar cotações
          </button>
          <button
            onClick={() => abrirModalTransacao()}
            className="flex items-center gap-2 border border-indigo-200 text-indigo-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50"
          >
            <Plus size={15} /> Lançamento
          </button>
          <button
            onClick={() => abrirModalAtivo()}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Plus size={15} /> Novo ativo
          </button>
        </div>
      </div>

      {/* cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card icon={<DollarSign size={18} />} cor="blue" titulo="Total investido" valor={formatCurrency(totalInvestido)} />
        <Card icon={<BarChart2 size={18} />} cor="indigo" titulo="Valor atual" valor={formatCurrency(totalAtual)} />
        <Card
          icon={totalRendimento >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          cor={totalRendimento >= 0 ? "green" : "red"}
          titulo="Rendimento"
          valor={formatCurrency(totalRendimento)}
          sub={`Proventos: ${formatCurrency(totalProventos)}`}
        />
        <Card
          icon={<Percent size={18} />}
          cor={pctRendimento >= 0 ? "green" : "red"}
          titulo="Rendimento %"
          valor={`${pctRendimento >= 0 ? "+" : ""}${pctRendimento.toFixed(2)}%`}
        />
      </div>

      {/* abas */}
      <div className="flex gap-1 border-b">
        {(["portfolio", "lancamentos"] as const).map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              aba === a ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {a === "portfolio" ? "Portfólio" : "Lançamentos"}
          </button>
        ))}
      </div>

      {/* aba portfólio */}
      {aba === "portfolio" && (
        <div className="space-y-5">
          {/* gráfico de alocação */}
          {alocacaoPorClasse.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Alocação por classe</h2>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={alocacaoPorClasse} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={renderLabel}>
                    {alocacaoPorClasse.map((e, i) => <Cell key={i} fill={e.cor} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* tabela de ativos */}
          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            {ativos.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-12">Nenhum ativo cadastrado. Clique em &ldquo;Novo ativo&rdquo; para começar.</p>
            ) : (
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-600 text-left">
                    <th className="px-4 py-3 font-medium">Ativo</th>
                    <th className="px-4 py-3 font-medium">Classe</th>
                    <th className="px-4 py-3 font-medium text-right">Qtd</th>
                    <th className="px-4 py-3 font-medium text-right">P. Médio</th>
                    <th className="px-4 py-3 font-medium text-right">P. Atual</th>
                    <th className="px-4 py-3 font-medium text-right">V. Investido</th>
                    <th className="px-4 py-3 font-medium text-right">V. Atual</th>
                    <th className="px-4 py-3 font-medium text-right">Rendimento</th>
                    <th className="px-4 py-3 font-medium text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {ativos.map((a) => {
                    const cotacao = cotacoes[a.ticker];
                    const vAtual = valorAtual(a);
                    const rend = rendimentoTotal(a);
                    const pct = a.posicao.valorInvestido > 0 ? (rend / a.posicao.valorInvestido) * 100 : 0;
                    const cls = CLASSES[a.classe];
                    return (
                      <tr key={a.id} className={`border-b last:border-0 hover:bg-gray-50 ${a.posicao.quantidade === 0 ? "opacity-50" : ""}`}>
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-semibold text-gray-900">{a.ticker}</span>
                            <p className="text-xs text-gray-400">{a.nome}</p>
                            {a.corretora && <p className="text-xs text-gray-400">{a.corretora}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: cls?.cor }}>
                            {cls?.label ?? a.classe}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {a.posicao.quantidade % 1 === 0 ? a.posicao.quantidade.toFixed(0) : a.posicao.quantidade.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(a.posicao.precoMedio)}</td>
                        <td className="px-4 py-3 text-right">
                          {cls?.variavel ? (
                            cotacao ? (
                              <span className={cotacao.regularMarketChangePercent >= 0 ? "text-green-600" : "text-red-500"}>
                                {formatCurrency(cotacao.regularMarketPrice)}
                                <span className="text-xs ml-1">({cotacao.regularMarketChangePercent >= 0 ? "+" : ""}{cotacao.regularMarketChangePercent.toFixed(2)}%)</span>
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )
                          ) : (
                            <span className="text-gray-400 flex items-center justify-end gap-1"><Lock size={12} /> Fixo</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(a.posicao.valorInvestido)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">{formatCurrency(vAtual)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${rend >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {formatCurrency(rend)}
                            <span className="text-xs font-normal ml-1">({pct >= 0 ? "+" : ""}{pct.toFixed(2)}%)</span>
                          </span>
                          {a.posicao.proventos > 0 && (
                            <p className="text-xs text-gray-400">+{formatCurrency(a.posicao.proventos)} proventos</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => abrirModalAtivo(a)} className="text-gray-400 hover:text-indigo-600"><Pencil size={14} /></button>
                            <button onClick={() => excluirAtivo(a.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* aba lançamentos */}
      {aba === "lancamentos" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          {transacoes.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-12">Nenhum lançamento registrado.</p>
          ) : (
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600 text-left">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Ativo</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium text-right">Qtd</th>
                  <th className="px-4 py-3 font-medium text-right">Preço</th>
                  <th className="px-4 py-3 font-medium text-right">Valor</th>
                  <th className="px-4 py-3 font-medium text-right">Taxas</th>
                  <th className="px-4 py-3 font-medium">Conta</th>
                  <th className="px-4 py-3 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {transacoes.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{formatDate(t.data)}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-800">{t.ativo.ticker}</span>
                      <p className="text-xs text-gray-400">{t.ativo.nome}</p>
                    </td>
                    <td className="px-4 py-3">
                      <TipoBadge tipo={t.tipo} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {t.quantidade > 0 ? (t.quantidade % 1 === 0 ? t.quantidade.toFixed(0) : t.quantidade.toFixed(4)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {t.preco > 0 ? formatCurrency(t.preco) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">{formatCurrency(t.valor)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{t.taxas > 0 ? formatCurrency(t.taxas) : "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{t.conta?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => abrirModalTransacao(t)} className="text-gray-400 hover:text-indigo-600"><Pencil size={14} /></button>
                        <button onClick={() => excluirTransacao(t.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* modal novo/editar ativo */}
      {modalAtivo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold">{editandoAtivo ? "Editar" : "Novo"} ativo</h2>
              <button onClick={() => setModalAtivo(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={salvarAtivo} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ticker *</label>
                  <input required className="input" value={formAtivo.ticker} onChange={(e) => setFormAtivo((f) => ({ ...f, ticker: e.target.value.toUpperCase() }))} placeholder="PETR4" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Classe *</label>
                  <select required className="input" value={formAtivo.classe} onChange={(e) => setFormAtivo((f) => ({ ...f, classe: e.target.value }))}>
                    {Object.entries(CLASSES).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nome *</label>
                <input required className="input" value={formAtivo.nome} onChange={(e) => setFormAtivo((f) => ({ ...f, nome: e.target.value }))} placeholder="Petrobras PN" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Corretora</label>
                <input className="input" value={formAtivo.corretora} onChange={(e) => setFormAtivo((f) => ({ ...f, corretora: e.target.value }))} placeholder="XP, Rico, Clear..." />
              </div>
              {formAtivo.classe === "renda_fixa" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Indexador</label>
                      <select className="input" value={formAtivo.indexador} onChange={(e) => setFormAtivo((f) => ({ ...f, indexador: e.target.value }))}>
                        <option value="">Selecione</option>
                        <option>CDI</option><option>IPCA</option><option>SELIC</option><option>Prefixado</option><option>IGPM</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Taxa (% a.a.)</label>
                      <input type="number" step="0.01" className="input" value={formAtivo.taxa} onChange={(e) => setFormAtivo((f) => ({ ...f, taxa: e.target.value }))} placeholder="12.5" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Vencimento</label>
                    <input type="date" className="input" value={formAtivo.vencimento} onChange={(e) => setFormAtivo((f) => ({ ...f, vencimento: e.target.value }))} />
                  </div>
                </>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalAtivo(false)} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* modal novo/editar lançamento */}
      {modalTransacao && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold">{editandoTransacao ? "Editar" : "Novo"} lançamento</h2>
              <button onClick={() => setModalTransacao(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={salvarTransacao} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Ativo *</label>
                  <select required className="input" value={formTransacao.ativoId} onChange={(e) => setFormTransacao((f) => ({ ...f, ativoId: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {ativos.map((a) => <option key={a.id} value={a.id}>{a.ticker} — {a.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
                  <select required className="input" value={formTransacao.tipo} onChange={(e) => setFormTransacao((f) => ({ ...f, tipo: e.target.value }))}>
                    {Object.entries(TIPOS_TRANSACAO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              {["compra", "venda"].includes(formTransacao.tipo) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Quantidade</label>
                    <input type="number" step="0.0001" min="0" className="input" value={formTransacao.quantidade} onChange={(e) => handleQtdPreco("quantidade", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Preço unitário (R$)</label>
                    <input type="number" step="0.01" min="0" className="input" value={formTransacao.preco} onChange={(e) => handleQtdPreco("preco", e.target.value)} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Valor total (R$) *</label>
                  <input required type="number" step="0.01" min="0" className="input" value={formTransacao.valor} onChange={(e) => setFormTransacao((f) => ({ ...f, valor: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Taxas (R$)</label>
                  <input type="number" step="0.01" min="0" className="input" value={formTransacao.taxas} onChange={(e) => setFormTransacao((f) => ({ ...f, taxas: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data *</label>
                  <input required type="date" className="input" value={formTransacao.data} onChange={(e) => setFormTransacao((f) => ({ ...f, data: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Conta</label>
                  <select className="input" value={formTransacao.contaId} onChange={(e) => setFormTransacao((f) => ({ ...f, contaId: e.target.value }))}>
                    <option value="">Nenhuma</option>
                    {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Observação</label>
                <input className="input" value={formTransacao.observacao} onChange={(e) => setFormTransacao((f) => ({ ...f, observacao: e.target.value }))} placeholder="Opcional" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalTransacao(false)} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── sub-componentes ──────────────────────────────────────────────────────────

function Card({ icon, cor, titulo, valor, sub }: { icon: React.ReactNode; cor: string; titulo: string; valor: string; sub?: string }) {
  const cores: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg flex-shrink-0 ${cores[cor]}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{titulo}</p>
        <p className="text-lg font-bold text-gray-800">{valor}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: string }) {
  const estilos: Record<string, string> = {
    compra:      "bg-green-100 text-green-700",
    venda:       "bg-red-100 text-red-700",
    dividendo:   "bg-blue-100 text-blue-700",
    jscp:        "bg-purple-100 text-purple-700",
    rendimento:  "bg-teal-100 text-teal-700",
    amortizacao: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${estilos[tipo] ?? "bg-gray-100 text-gray-600"}`}>
      {TIPOS_TRANSACAO[tipo] ?? tipo}
    </span>
  );
}
