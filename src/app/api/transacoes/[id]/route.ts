import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const transacao = await prisma.transacao.update({
    where: { id: Number(id) },
    data: { ...body, data: new Date(body.data) },
    include: { categoria: true },
  });
  return NextResponse.json(transacao);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.transacao.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
