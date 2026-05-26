import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const conta = await prisma.conta.update({ where: { id: Number(id) }, data: body });
  return NextResponse.json(conta);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.conta.update({ where: { id: Number(id) }, data: { ativo: false } });
  return NextResponse.json({ ok: true });
}
