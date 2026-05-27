-- CreateTable
CREATE TABLE "Ativo" (
    "id" SERIAL NOT NULL,
    "ticker" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "classe" TEXT NOT NULL,
    "indexador" TEXT,
    "taxa" DOUBLE PRECISION,
    "vencimento" TIMESTAMP(3),
    "corretora" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransacaoInvestimento" (
    "id" SERIAL NOT NULL,
    "ativoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "preco" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valor" DOUBLE PRECISION NOT NULL,
    "taxas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "data" TIMESTAMP(3) NOT NULL,
    "contaId" INTEGER,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransacaoInvestimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ativo_ticker_key" ON "Ativo"("ticker");

-- AddForeignKey
ALTER TABLE "TransacaoInvestimento" ADD CONSTRAINT "TransacaoInvestimento_ativoId_fkey" FOREIGN KEY ("ativoId") REFERENCES "Ativo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransacaoInvestimento" ADD CONSTRAINT "TransacaoInvestimento_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
