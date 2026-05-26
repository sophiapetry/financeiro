"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import SeletorMes from "@/components/SeletorMes";
import ModalTransacao from "@/components/ModalTransacao";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface Categoria { id: number; nome: string; cor: string; tipo: string }
interface Transacao {
  id: number;
  descricao: string;
  valor: number;
  tipo: string;
  data: string;
  categoriaId: number;
  observacao?: string;
  categoria: Categoria;
}

export default function TransacoesPage() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [filtro, setFiltro] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Transacao | null>(null);

  const carregar = useCallback(() => {
    fetch(`/api/transacoes?mes=${mes}&ano=${ano}`)
      .then((r) => r.json())
      .then(setTransacoes);
  }, [mes, ano]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(dados: Omit<Transacao, "id" | "categoria"> & { id?: number }) {
    const url = dados.id ? `/api/transacoes/${dados.id}` : "/api/transacoes";
    const method = dados.id ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) });
    setModalAberto(false);
    setEditando(null);
    carregar();
  }

  async function excluir(id: number) {
    if (!confirm("Excluir esta transação?")) return;
    await fetch(`/api/transacoes/${id}`, { method: "DELETE" });
    carregar();
  }

  const filtradas = transacoes.filter((t) =>
    t.descricao.toLowerCase().includes(filtro.toLowerCase()) ||
    t.categoria.nome.toLowerCase().includes(filtro.toLowerCase())
  );

  const totalReceitas = filtradas.filter((t) => t.tipo === "receita").reduce((s, t) => s + t.valor, 0);
  const totalDespesas = filtradas.filter((t) => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Transações</h1>
        <div className="flex items-center gap-3">
          <SeletorMes mes={mes} ano={ano} onChange={(m, a) => { setMes(m); setAno(a); }} />
          <button
            onClick={() => { setEditando(null); setModalAberto(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Plus size={16} /> Nova transação
          </button>
        </div>
      </div>

      <div className="flex gap-4 text-sm">
        <span className="text-green-600 font-semibold">Receitas: {formatCurrency(totalReceitas)}</span>
        <span className="text-gray-400">|</span>
        <span className="text-red-600 font-semibold">Despesas: {formatCurrency(totalDespesas)}</span>
        <span className="text-gray-400">|</span>
        <span className={`font-semibold ${totalReceitas - totalDespesas >= 0 ? "text-blue-600" : "text-red-600"}`}>
          Saldo: {formatCurrency(totalReceitas - totalDespesas)}
        </span>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Buscar por descrição ou categoria..."
          className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {filtradas.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-12">Nenhuma transação encontrada.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600 text-left">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
                <th className="px-4 py-3 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((t) => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(t.data)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{t.descricao}</p>
                    {t.observacao && <p className="text-xs text-gray-400">{t.observacao}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: t.categoria.cor }}>
                      {t.categoria.nome}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${t.tipo === "receita" ? "text-green-600" : "text-red-600"}`}>
                    {t.tipo === "receita" ? "+" : "-"}{formatCurrency(t.valor)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => { setEditando(t); setModalAberto(true); }} className="text-gray-400 hover:text-indigo-600">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => excluir(t.id)} className="text-gray-400 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ModalTransacao
        aberto={modalAberto}
        onFechar={() => { setModalAberto(false); setEditando(null); }}
        onSalvar={salvar}
        transacaoInicial={editando ? { ...editando, data: editando.data.split("T")[0] } : null}
      />
    </div>
  );
}
