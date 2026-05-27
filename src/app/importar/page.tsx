"use client";
import { useState, useEffect, useRef } from "react";
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet, ArrowLeft, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";

interface TransacaoPreview {
  data: string;
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  categoriaId: number | null;
  categoriaSkill: string;
}

interface Conta { id: number; nome: string; cor: string }
interface Categoria { id: number; nome: string; tipo: string }

type Etapa = "upload" | "preview" | "sucesso";

export default function ImportarPage() {
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<TransacaoPreview[]>([]);
  const [banco, setBanco] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<string | null>(null);
  const [contas, setContas] = useState<Conta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contaId, setContaId] = useState<number | "">("");
  const [importando, setImportando] = useState(false);
  const [totalImportado, setTotalImportado] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/contas").then((r) => r.json()).then(setContas);
    fetch("/api/categorias").then((r) => r.json()).then(setCategorias);
  }, []);

  async function handleArquivo(file: File) {
    const ext = file.name.toLowerCase();
    const aceitos = [".pdf", ".xlsx", ".xls", ".csv", ".txt", ".ofx", ".qfx"];
    if (!aceitos.some((e) => ext.endsWith(e))) {
      setErro("Formato não suportado. Envie .pdf, .xlsx, .csv ou .ofx.");
      return;
    }
    setArquivo(file);
    setErro(null);
    setCarregando(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/importar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setErro(data.erro ?? "Erro ao processar arquivo."); return; }
      if (!data.transacoes?.length) {
        setErro("Nenhuma transação encontrada. Certifique-se de enviar um extrato bancário (não um comprovante avulso).");
        return;
      }
      setPreview(data.transacoes);
      setBanco(data.banco);
      setPeriodo(data.periodo);
      setEtapa("preview");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setErro(msg.includes("PDF") ? "Erro ao ler o PDF. Tente exportar como OFX ou CSV no internet banking." : "Falha ao processar o arquivo.");
    } finally {
      setCarregando(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleArquivo(file);
  }

  function atualizarCategoria(idx: number, categoriaId: number) {
    setPreview((prev) => prev.map((t, i) => i === idx ? { ...t, categoriaId } : t));
  }

  async function confirmarImportacao() {
    if (!contaId) { setErro("Selecione a conta bancária antes de importar."); return; }
    setImportando(true);
    setErro(null);
    try {
      const payload = preview
        .filter((t) => t.categoriaId)
        .map((t) => ({
          descricao: t.descricao,
          valor: t.valor,
          tipo: t.tipo,
          data: t.data,
          categoriaId: t.categoriaId,
          contaId: Number(contaId),
        }));
      const res = await fetch("/api/transacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setTotalImportado(data.count ?? payload.length);
      setEtapa("sucesso");
    } catch {
      setErro("Erro ao salvar as transações.");
    } finally {
      setImportando(false);
    }
  }

  const semCategoria = preview.filter((t) => !t.categoriaId).length;

  if (etapa === "sucesso") {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <CheckCircle size={56} className="text-green-500" />
        <h2 className="text-2xl font-bold text-gray-800">{totalImportado} transações importadas!</h2>
        <p className="text-gray-500 text-sm">As transações já estão disponíveis na aba Transações.</p>
        <button
          onClick={() => { setEtapa("upload"); setArquivo(null); setPreview([]); setBanco(null); setPeriodo(null); setContaId(""); }}
          className="mt-4 flex items-center gap-2 text-indigo-600 hover:underline text-sm"
        >
          <ArrowLeft size={16} /> Importar outro extrato
        </button>
      </div>
    );
  }

  if (etapa === "preview") {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Revisar importação</h1>
            {(banco || periodo) && (
              <p className="text-sm text-gray-500 mt-0.5">
                {banco && <span className="font-medium">{banco}</span>}
                {banco && periodo && " · "}
                {periodo && <span>{periodo}</span>}
              </p>
            )}
          </div>
          <button onClick={() => { setEtapa("upload"); setArquivo(null); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft size={16} /> Voltar
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <FileSpreadsheet size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-800 font-medium">{preview.length} transações detectadas</p>
            {semCategoria > 0 && (
              <p className="text-xs text-blue-600 mt-0.5">{semCategoria} transações sem categoria — atribua abaixo antes de importar.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Conta bancária</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={contaId}
              onChange={(e) => setContaId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Selecione a conta...</option>
              {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <button
            onClick={confirmarImportacao}
            disabled={importando || !contaId}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {importando ? "Importando..." : "Confirmar importação"}
          </button>
        </div>

        {erro && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={16} /> {erro}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600 text-left">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((t, i) => (
                <tr key={i} className={`border-b last:border-0 ${!t.categoriaId ? "bg-yellow-50" : "hover:bg-gray-50"}`}>
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(t.data)}</td>
                  <td className="px-4 py-2.5 text-gray-800 max-w-xs truncate">{t.descricao}</td>
                  <td className="px-4 py-2.5">
                    <select
                      className={`border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 ${!t.categoriaId ? "border-yellow-400 bg-yellow-50" : ""}`}
                      value={t.categoriaId ?? ""}
                      onChange={(e) => atualizarCategoria(i, Number(e.target.value))}
                    >
                      <option value="">Sem categoria</option>
                      {categorias
                        .filter((c) => c.tipo === t.tipo)
                        .map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold whitespace-nowrap ${t.tipo === "receita" ? "text-green-600" : "text-red-600"}`}>
                    {t.tipo === "receita" ? "+" : "-"}{formatCurrency(t.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Importar extrato</h1>
      <p className="text-gray-500 text-sm">
        Suporta <strong>PDF, Excel, CSV e OFX</strong> — qualquer formato exportado pelo banco.
        Itaú, Banco do Brasil, Caixa, Banrisul, Nubank, PicPay e PagSeguro.
      </p>

      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        {carregando ? (
          <>
            <Loader2 size={40} className="text-indigo-500 animate-spin" />
            <p className="text-gray-600 font-medium">Processando extrato...</p>
          </>
        ) : (
          <>
            <Upload size={40} className="text-gray-400" />
            <div className="text-center">
              <p className="text-gray-700 font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
              <p className="text-gray-400 text-sm mt-1">PDF · Excel · CSV · OFX</p>
            </div>
            {arquivo && <p className="text-indigo-600 text-sm font-medium">{arquivo.name}</p>}
          </>
        )}
        <input ref={inputRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.txt,.ofx,.qfx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleArquivo(f); }} />
      </div>

      {erro && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle size={16} /> {erro}
        </div>
      )}

      <div className="bg-gray-50 rounded-xl border p-5 space-y-3">
        <h3 className="font-semibold text-gray-700 text-sm">Como usar</h3>
        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
          <li>No app ou site do banco, exporte o extrato (<strong>PDF, Excel, CSV ou OFX</strong>)</li>
          <li>Faça upload aqui — o banco é detectado automaticamente</li>
          <li>Revise as transações e selecione a conta</li>
          <li>Confirme a importação</li>
        </ol>
        <p className="text-xs text-gray-400 pt-1">Use o <strong>extrato do período</strong>, não comprovantes avulsos. OFX é o formato mais preciso. PDFs escaneados não funcionam.</p>
      </div>
    </div>
  );
}
