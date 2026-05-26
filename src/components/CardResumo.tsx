interface CardResumoProps {
  titulo: string;
  valor: string;
  cor: "verde" | "vermelho" | "azul" | "roxo";
  icone: React.ReactNode;
  subtitulo?: string;
}

const cores = {
  verde: "bg-green-50 border-green-200 text-green-700",
  vermelho: "bg-red-50 border-red-200 text-red-700",
  azul: "bg-blue-50 border-blue-200 text-blue-700",
  roxo: "bg-indigo-50 border-indigo-200 text-indigo-700",
};

export default function CardResumo({ titulo, valor, cor, icone, subtitulo }: CardResumoProps) {
  return (
    <div className={`rounded-xl border-2 p-5 ${cores[cor]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium opacity-80">{titulo}</span>
        <span className="opacity-60">{icone}</span>
      </div>
      <p className="text-2xl font-bold">{valor}</p>
      {subtitulo && <p className="text-xs opacity-60 mt-1">{subtitulo}</p>}
    </div>
  );
}
