"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface Categoria {
  id: number;
  nome: string;
  tipo: string;
}

interface Transacao {
  id?: number;
  descricao: string;
  valor: number;
  tipo: string;
  data: string;
  categoriaId: number;
  observacao?: string;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (transacao: Transacao) => void;
  transacaoInicial?: Transacao | null;
}

const vazio: Transacao = {
  descricao: "",
  valor: 0,
  tipo: "despesa",
  data: new Date().toISOString().split("T")[0],
  categoriaId: 0,
  observacao: "",
};

export default function ModalTransacao({ aberto, onFechar, onSalvar, transacaoInicial }: Props) {
  const [form, setForm] = useState<Transacao>(vazio);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  useEffect(() => {
    fetch("/api/categorias").then((r) => r.json()).then(setCategorias);
  }, []);

  useEffect(() => {
    setForm(transacaoInicial ? { ...transacaoInicial } : vazio);
  }, [transacaoInicial, aberto]);

  if (!aberto) return null;

  const categoriasFiltradas = categorias.filter((c) => c.tipo === form.tipo || c.tipo === "ambos");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.categoriaId) return;
    onSalvar(form);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold">
            {transacaoInicial?.id ? "Editar" : "Nova"} Transação
          </h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex gap-2">
            {["despesa", "receita"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, tipo: t, categoriaId: 0 }))}
                className={`flex-1 py-2 rounded-lg font-medium text-sm border-2 transition-colors ${
                  form.tipo === t
                    ? t === "despesa"
                      ? "bg-red-50 border-red-400 text-red-700"
                      : "bg-green-50 border-green-400 text-green-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {t === "despesa" ? "Despesa" : "Receita"}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.valor || ""}
                onChange={(e) => setForm((f) => ({ ...f, valor: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                required
                type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.data}
                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              required
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.categoriaId || ""}
              onChange={(e) => setForm((f) => ({ ...f, categoriaId: Number(e.target.value) }))}
            >
              <option value="">Selecione...</option>
              {categoriasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observação <span className="text-gray-400">(opcional)</span>
            </label>
            <textarea
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              value={form.observacao || ""}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onFechar}
              className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
