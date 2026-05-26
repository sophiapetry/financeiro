import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const categorias = await prisma.categoria.findMany({ orderBy: { nome: "asc" } });
  return NextResponse.json(categorias);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const categoria = await prisma.categoria.create({ data: body });
  return NextResponse.json(categoria, { status: 201 });
}
