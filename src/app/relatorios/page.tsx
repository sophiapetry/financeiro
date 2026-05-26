"use client";
import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import SeletorMes from "@/components/SeletorMes";
import { formatCurrency, MESES } from "@/lib/formatters";

interface Transacao {
  id: number;
  descricao: string;
  valor: number;
  tipo: string;
  data: string;
  categoria: { id: number; nome: string; cor: string };
}

export default function RelatoriosPage() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);

  const carregar = useCallback(() => {
    fetch(`/api/transacoes?mes=${mes}&ano=${ano}`).then((r) => r.json()).then(setTransacoes);
  }, [mes, ano]);

  useEffect(() => { carregar(); }, [carregar]);

  const despesas = transacoes.filter((t) => t.tipo === "despesa");
  const receitas = transacoes.filter((t) => t.tipo === "receita");

  const totalDespesas = despesas.reduce((s, t) => s + t.valor, 0);
  const totalReceitas = receitas.reduce((s, t) => s + t.valor, 0);

  const porCategoriaDespesa = Object.values(
    despesas.reduce((acc, t) => {
      if (!acc[t.categoria.id]) acc[t.categoria.id] = { nome: t.categoria.nome, cor: t.categoria.cor, total: 0 };
      acc[t.categoria.id].total += t.valor;
      return acc;
    }, {} as Record<number, { nome: string; cor: string; total: number }>)
  ).sort((a, b) => b.total - a.total);

  const porDia = Array.from({ length: new Date(ano, mes, 0).getDate() }, (_, i) => {
    const dia = i + 1;
    const txDia = transacoes.filter((t) => new Date(t.data).getDate() === dia);
    return {
      dia: `${dia}`,
      receitas: txDia.filter((t) => t.tipo === "receita").reduce((s, t) => s + t.valor, 0),
      despesas: txDia.filter((t) => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0),
    };
  }).filter((d) => d.receitas > 0 || d.despesas > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <SeletorMes mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-600 font-medium">Total de Receitas</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totalReceitas)}</p>
          <p className="text-xs text-green-500">{receitas.length} lançamentos</p>
        </div>
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">Total de Despesas</p>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(totalDespesas)}</p>
          <p className="text-xs text-red-500">{despesas.length} lançamentos</p>
        </div>
        <div className={`border-2 rounded-xl p-4 ${totalReceitas - totalDespesas >= 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"}`}>
          <p className={`text-sm font-medium ${totalReceitas - totalDespesas >= 0 ? "text-blue-600" : "text-red-600"}`}>Resultado</p>
          <p className={`text-2xl font-bold ${totalReceitas - totalDespesas >= 0 ? "text-blue-700" : "text-red-700"}`}>{formatCurrency(totalReceitas - totalDespesas)}</p>
          <p className="text-xs text-gray-400">{MESES[mes - 1]} de {ano}</p>
        </div>
      </div>

      {porDia.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Lançamentos por dia</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={porDia} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {porCategoriaDespesa.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Despesas por categoria</h2>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={porCategoriaDespesa} dataKey="total" nameKey="nome" cx="50%" cy="50%" outerRadius={90} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}>
                  {porCategoriaDespesa.map((c, i) => <Cell key={i} fill={c.cor} />)}
                </Pie>
                <Legend />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Ranking de despesas</h2>
            <div className="space-y-3">
              {porCategoriaDespesa.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{c.nome}</span>
                      <span className="text-gray-600">{formatCurrency(c.total)} ({((c.total / totalDespesas) * 100).toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(c.total / totalDespesas) * 100}%`, backgroundColor: c.cor }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {transacoes.length === 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center text-gray-400 text-sm">
          Nenhuma transação registrada neste período.
        </div>
      )}
    </div>
  );
}
