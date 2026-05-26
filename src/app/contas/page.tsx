"use client";
import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Conta {
  id: number;
  nome: string;
  tipo: string;
  cor: string;
  saldoInicial: number;
  saldo: number;
}

const CORES = ["#3b82f6", "#8b5cf6", "#22c55e", "#ef4444", "#f59e0b", "#ec4899", "#06b6d4", "#f97316", "#facc15", "#94a3b8"];

const TIPOS: Record<string, string> = {
  corrente: "Conta Corrente",
  poupanca: "Poupança",
  acoes: "Ações",
  renda_fixa: "Renda Fixa",
  tesouro: "Tesouro Direto",
  cofrinho: "Cofrinho",
  carteira: "Carteira",
  outro: "Outro",
};

const vazio = { nome: "", tipo: "corrente", cor: "#3b82f6", saldoInicial: 0 };

export default function ContasPage() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [form, setForm] = useState(vazio);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    const data = await fetch("/api/contas").then((r) => r.json());
    setContas(data);
  }

  function abrir(c?: Conta) {
    if (c) {
      setForm({ nome: c.nome, tipo: c.tipo, cor: c.cor, saldoInicial: c.saldoInicial });
      setEditandoId(c.id);
    } else {
      setForm(vazio);
      setEditandoId(null);
    }
    setModalAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const url = editandoId ? `/api/contas/${editandoId}` : "/api/contas";
    const method = editandoId ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setModalAberto(false);
    carregar();
  }

  async function excluir(id: number) {
    if (!confirm("Arquivar esta conta? As transações vinculadas serão mantidas.")) return;
    await fetch(`/api/contas/${id}`, { method: "DELETE" });
    carregar();
  }

  const totalSaldo = contas.reduce((s, c) => s + c.saldo, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Contas</h1>
        <button
          onClick={() => abrir()}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          <Plus size={16} /> Nova conta
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3">
          <div className="p-2 bg-green-50 rounded-lg"><TrendingUp size={20} className="text-green-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Contas ativas</p>
            <p className="text-lg font-bold text-gray-800">{contas.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3 sm:col-span-2">
          <div className="p-2 bg-blue-50 rounded-lg"><Wallet size={20} className="text-blue-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Patrimônio total</p>
            <p className={`text-lg font-bold ${totalSaldo >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {formatCurrency(totalSaldo)}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {contas.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-12">Nenhuma conta cadastrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600 text-left">
                <th className="px-4 py-3 font-medium">Conta</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium text-right">Saldo inicial</th>
                <th className="px-4 py-3 font-medium text-right">Saldo atual</th>
                <th className="px-4 py-3 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contas.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: c.cor }} />
                      <span className="font-medium text-gray-800">{c.nome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{TIPOS[c.tipo] ?? c.tipo}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(c.saldoInicial)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${c.saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
                    <div className="flex items-center justify-end gap-1">
                      {c.saldo >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {formatCurrency(c.saldo)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => abrir(c)} className="text-gray-400 hover:text-indigo-600"><Pencil size={15} /></button>
                      <button onClick={() => excluir(c.id)} className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold">{editandoId ? "Editar" : "Nova"} conta</h2>
              <button onClick={() => setModalAberto(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={salvar} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Nubank, Itaú, Cofrinho..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                >
                  {Object.entries(TIPOS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Saldo inicial (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.saldoInicial}
                  onChange={(e) => setForm((f) => ({ ...f, saldoInicial: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {CORES.map((cor) => (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, cor }))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${form.cor === cor ? "border-gray-800 scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: cor }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalAberto(false)} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
