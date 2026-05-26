"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, X, AlertTriangle } from "lucide-react";
import SeletorMes from "@/components/SeletorMes";
import { formatCurrency } from "@/lib/formatters";

interface Categoria { id: number; nome: string; tipo: string; cor: string }
interface Orcamento {
  id: number;
  categoriaId: number;
  mes: number;
  ano: number;
  limite: number;
  categoria: Categoria;
}
interface Transacao { valor: number; tipo: string; categoriaId: number }

export default function OrcamentoPage() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ categoriaId: 0, limite: "" });

  const carregar = useCallback(async () => {
    const [orc, tx, cats] = await Promise.all([
      fetch(`/api/orcamentos?mes=${mes}&ano=${ano}`).then((r) => r.json()),
      fetch(`/api/transacoes?mes=${mes}&ano=${ano}`).then((r) => r.json()),
      fetch("/api/categorias").then((r) => r.json()),
    ]);
    setOrcamentos(orc);
    setTransacoes(tx);
    setCategorias(cats);
  }, [mes, ano]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/orcamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoriaId: Number(form.categoriaId), limite: Number(form.limite), mes, ano }),
    });
    setModal(false);
    setForm({ categoriaId: 0, limite: "" });
    carregar();
  }

  function gastoCategoria(categoriaId: number) {
    return transacoes.filter((t) => t.tipo === "despesa" && t.categoriaId === categoriaId).reduce((s, t) => s + t.valor, 0);
  }

  const catsSemOrcamento = categorias.filter((c) => c.tipo === "despesa" && !orcamentos.find((o) => o.categoriaId === c.id));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Orçamento</h1>
        <div className="flex items-center gap-3">
          <SeletorMes mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
          <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
            <Plus size={16} /> Definir limite
          </button>
        </div>
      </div>

      {orcamentos.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center text-gray-400 text-sm">
          Nenhum limite definido para este mês. Clique em &quot;Definir limite&quot; para começar.
        </div>
      ) : (
        <div className="grid gap-4">
          {orcamentos.map((o) => {
            const gasto = gastoCategoria(o.categoriaId);
            const pct = Math.round((gasto / o.limite) * 100);
            const sobra = o.limite - gasto;
            return (
              <div key={o.id} className="bg-white rounded-xl border shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: o.categoria.cor }} />
                    <span className="font-semibold text-gray-800">{o.categoria.nome}</span>
                    {pct > 100 && <AlertTriangle size={16} className="text-red-500" />}
                  </div>
                  <span className="text-sm text-gray-500">
                    Limite: <span className="font-medium text-gray-800">{formatCurrency(o.limite)}</span>
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${pct > 100 ? "bg-red-500" : pct > 80 ? "bg-yellow-400" : "bg-green-400"}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Gasto: <span className="font-medium text-gray-700">{formatCurrency(gasto)}</span> ({pct}%)</span>
                  <span className={sobra < 0 ? "text-red-600 font-semibold" : "text-gray-500"}>
                    {sobra < 0 ? `Excedeu ${formatCurrency(-sobra)}` : `Disponível: ${formatCurrency(sobra)}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold">Definir limite de orçamento</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={salvar} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={form.categoriaId} onChange={(e) => setForm((f) => ({ ...f, categoriaId: Number(e.target.value) }))}>
                  <option value="">Selecione...</option>
                  {catsSemOrcamento.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  {orcamentos.map((o) => <option key={o.id} value={o.categoriaId}>{o.categoria.nome} (editar)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Limite (R$)</label>
                <input required type="number" step="0.01" min="1" className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={form.limite} onChange={(e) => setForm((f) => ({ ...f, limite: e.target.value }))} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
