"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MESES } from "@/lib/formatters";

interface SeletorMesProps {
  mes: number;
  ano: number;
  onChange: (mes: number, ano: number) => void;
}

export default function SeletorMes({ mes, ano, onChange }: SeletorMesProps) {
  function anterior() {
    if (mes === 1) onChange(12, ano - 1);
    else onChange(mes - 1, ano);
  }
  function proximo() {
    if (mes === 12) onChange(1, ano + 1);
    else onChange(mes + 1, ano);
  }
  return (
    <div className="flex items-center gap-3">
      <button onClick={anterior} className="p-1 rounded hover:bg-gray-100 text-gray-600">
        <ChevronLeft size={20} />
      </button>
      <span className="font-semibold text-gray-800 min-w-[140px] text-center">
        {MESES[mes - 1]} {ano}
      </span>
      <button onClick={proximo} className="p-1 rounded hover:bg-gray-100 text-gray-600">
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
