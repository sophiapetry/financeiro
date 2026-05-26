"use client";
import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Landmark } from "lucide-react";
import Link from "next/link";
import CardResumo from "@/components/CardResumo";
import SeletorMes from "@/components/SeletorMes";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface DashboardData {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  gastosPorCategoria: { nome: string; cor: string; total: number }[];
  evolucao: { mes: string; receitas: number; despesas: number }[];
  progressoOrcamento: { categoria: string; cor: string; limite: number; gasto: number; percentual: number }[];
  ultimasTransacoes: { id: number; descricao: string; valor: number; tipo: string; data: string; categoria: { nome: string; cor: string } }[];
  saldoPorConta: { id: number; nome: string; cor: string; saldo: number }[];
}

export default function Dashboard() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [dados, setDados] = useState<DashboardData | null>(null);

  const carregar = useCallback(() => {
    fetch(`/api/dashboard?mes=${mes}&ano=${ano}`)
      .then((r) => r.json())
      .then(setDados);
  }, [mes, ano]);

  useEffect(() => { carregar(); }, [carregar]);

  if (!dados) return <div className="flex justify-center pt-20 text-gray-400">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <SeletorMes mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CardResumo titulo="Receitas" valor={formatCurrency(dados.totalReceitas)} cor="verde" icone={<TrendingUp size={20} />} />
        <CardResumo titulo="Despesas" valor={formatCurrency(dados.totalDespesas)} cor="vermelho" icone={<TrendingDown size={20} />} />
        <CardResumo titulo="Saldo" valor={formatCurrency(dados.saldo)} cor={dados.saldo >= 0 ? "azul" : "vermelho"} icone={<Wallet size={20} />} subtitulo={dados.saldo < 0 ? "Atenção: saldo negativo" : ""} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Evolução dos últimos 6 meses</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dados.evolucao} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Despesas por categoria</h2>
          {dados.gastosPorCategoria.length === 0 ? (
            <p className="text-gray-400 text-sm text-center pt-10">Nenhuma despesa registrada</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={dados.gastosPorCategoria} dataKey="total" nameKey="nome" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {dados.gastosPorCategoria.map((c, i) => <Cell key={i} fill={c.cor} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {dados.saldoPorConta.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Saldo por conta</h2>
            <Link href="/contas" className="text-xs text-indigo-600 hover:underline">Ver todas</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {dados.saldoPorConta.map((c) => (
              <div key={c.id} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.cor }} />
                  <span className="text-xs text-gray-500 truncate">{c.nome}</span>
                </div>
                <p className={`text-sm font-bold ${c.saldo >= 0 ? "text-gray-800" : "text-red-600"}`}>
                  {formatCurrency(c.saldo)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {dados.progressoOrcamento.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Progresso do orçamento</h2>
            <div className="space-y-3">
              {dados.progressoOrcamento.map((o, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 font-medium">{o.categoria}</span>
                    <span className={o.percentual > 100 ? "text-red-600 font-semibold" : "text-gray-500"}>
                      {formatCurrency(o.gasto)} / {formatCurrency(o.limite)}
                      {o.percentual > 100 && <AlertTriangle size={14} className="inline ml-1" />}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${o.percentual > 100 ? "bg-red-500" : o.percentual > 80 ? "bg-yellow-400" : "bg-green-400"}`} style={{ width: `${Math.min(o.percentual, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Últimas transações</h2>
          {dados.ultimasTransacoes.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhuma transação neste mês.</p>
          ) : (
            <div className="space-y-2">
              {dados.ultimasTransacoes.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t.descricao}</p>
                    <p className="text-xs text-gray-400">{t.categoria.nome} · {formatDate(t.data)}</p>
                  </div>
                  <span className={`text-sm font-semibold ${t.tipo === "receita" ? "text-green-600" : "text-red-600"}`}>
                    {t.tipo === "receita" ? "+" : "-"}{formatCurrency(t.valor)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
