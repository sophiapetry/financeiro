"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ArrowLeftRight, PieChart, Target, Settings, Landmark, Upload, TrendingUp } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transacoes", label: "Transações", icon: ArrowLeftRight },
  { href: "/contas", label: "Contas", icon: Landmark },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { href: "/importar", label: "Importar", icon: Upload },
  { href: "/relatorios", label: "Relatórios", icon: PieChart },
  { href: "/orcamento", label: "Orçamento", icon: Target },
  { href: "/categorias", label: "Categorias", icon: Settings },
];

export default function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-1 sticky top-0 z-50 shadow-sm">
      <span className="text-indigo-600 font-bold text-lg mr-6">💰 Financeiro</span>
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === href
              ? "bg-indigo-50 text-indigo-700"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <Icon size={16} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
