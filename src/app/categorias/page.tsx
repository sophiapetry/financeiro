"use client";
import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";

interface Categoria { id: number; nome: string; tipo: string; cor: string }

const CORES = ["#6366f1", "#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#ec4899", "#14b8a6", "#f97316", "#8b5cf6", "#06b6d4"];

const vazio = { nome: "", tipo: "despesa", cor: "#6366f1" };

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [form, setForm] = useState(vazio);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    const data = await fetch("/api/categorias").then((r) => r.json());
    setCategorias(data);
  }

  function abrir(c?: Categoria) {
    if (c) { setForm({ nome: c.nome, tipo: c.tipo, cor: c.cor }); setEditandoId(c.id); }
    else { setForm(vazio); setEditandoId(null); }
    setModalAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const url = editandoId ? `/api/categorias/${editandoId}` : "/api/categorias";
    const method = editandoId ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setModalAberto(false);
    carregar();
  }

  async function excluir(id: number) {
    if (!confirm("Excluir esta categoria? As transações vinculadas serão afetadas.")) return;
    await fetch(`/api/categorias/${id}`, { method: "DELETE" });
    carregar();
  }

  const receitas = categorias.filter((c) => c.tipo === "receita");
  const despesas = categorias.filter((c) => c.tipo === "despesa");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Categorias</h1>
        <button onClick={() => abrir()} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          <Plus size={16} /> Nova categoria
        </button>
      </div>

      {[{ titulo: "Receitas", lista: receitas }, { titulo: "Despesas", lista: despesas }].map(({ titulo, lista }) => (
        <div key={titulo} className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="font-semibold text-gray-700 mb-4">{titulo}</h2>
          {lista.length === 0 ? (
            <p className="text-gray-400 text-sm">Nenhuma categoria cadastrada.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {lista.map((c) => (
                <div key={c.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.cor }} />
                    <span className="text-sm font-medium text-gray-800">{c.nome}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => abrir(c)} className="text-gray-400 hover:text-indigo-600 p-1"><Pencil size={14} /></button>
                    <button onClick={() => excluir(c.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold">{editandoId ? "Editar" : "Nova"} categoria</h2>
              <button onClick={() => setModalAberto(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={salvar} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
                  <option value="despesa">Despesa</option>
                  <option value="receita">Receita</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {CORES.map((cor) => (
                    <button key={cor} type="button" onClick={() => setForm((f) => ({ ...f, cor }))} className={`w-7 h-7 rounded-full border-2 transition-all ${form.cor === cor ? "border-gray-800 scale-110" : "border-transparent"}`} style={{ backgroundColor: cor }} />
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
