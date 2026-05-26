import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const contas = [
    { nome: "Itaú", tipo: "corrente", cor: "#f97316" },
    { nome: "Banco do Brasil", tipo: "corrente", cor: "#facc15" },
    { nome: "Caixa", tipo: "corrente", cor: "#3b82f6" },
    { nome: "Banrisul", tipo: "corrente", cor: "#ef4444" },
    { nome: "Nubank", tipo: "digital", cor: "#8b5cf6" },
    { nome: "PicPay", tipo: "digital", cor: "#22c55e" },
    { nome: "PagSeguro", tipo: "digital", cor: "#f59e0b" },
  ];

  for (const conta of contas) {
    await prisma.conta.upsert({
      where: { nome: conta.nome },
      update: {},
      create: conta,
    });
  }
  console.log("Seed: 8 contas criadas.");

  const categorias = [
    { nome: "Salário", tipo: "receita", cor: "#22c55e" },
    { nome: "Freelance", tipo: "receita", cor: "#14b8a6" },
    { nome: "Investimentos", tipo: "receita", cor: "#3b82f6" },
    { nome: "Outros (Receita)", tipo: "receita", cor: "#8b5cf6" },
    { nome: "Alimentação", tipo: "despesa", cor: "#f59e0b" },
    { nome: "Moradia", tipo: "despesa", cor: "#ef4444" },
    { nome: "Transporte", tipo: "despesa", cor: "#f97316" },
    { nome: "Saúde", tipo: "despesa", cor: "#ec4899" },
    { nome: "Educação", tipo: "despesa", cor: "#6366f1" },
    { nome: "Lazer", tipo: "despesa", cor: "#06b6d4" },
    { nome: "Vestuário", tipo: "despesa", cor: "#8b5cf6" },
    { nome: "Outros (Despesa)", tipo: "despesa", cor: "#94a3b8" },
  ];

  for (const cat of categorias) {
    await prisma.categoria.upsert({
      where: { nome: cat.nome },
      update: {},
      create: cat,
    });
  }
  console.log("Seed concluído: 12 categorias criadas.");
  console.log("Seed concluído!");
}

main().finally(() => prisma.$disconnect());
