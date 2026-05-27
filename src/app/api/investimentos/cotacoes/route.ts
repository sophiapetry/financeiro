import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tickers = searchParams.get("tickers");

  if (!tickers) return NextResponse.json([]);

  const token = process.env.BRAPI_TOKEN;
  const url = `https://brapi.dev/api/quote/${tickers}${token ? `?token=${token}` : ""}`;

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    const data = await res.json();
    return NextResponse.json(data.results ?? []);
  } catch {
    return NextResponse.json([]);
  }
}
