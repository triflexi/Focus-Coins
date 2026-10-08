-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastRewardDay" TEXT,
    "boostUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RefreshToken" (
    "hash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "public"."FocusSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "multiplier" INTEGER NOT NULL DEFAULT 100,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reward" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "FocusSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Season" (
    "key" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Season_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "reserved" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DailyReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."GameRound" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stake" BIGINT NOT NULL,
    "payout" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "hazards" INTEGER[],
    "picks" INTEGER[],
    "floors" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SeasonResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,
    "balance" BIGINT NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "SeasonResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Idempotency" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Visit" (
    "userId" TEXT NOT NULL,
    "lastActivity" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_login_key" ON "public"."User"("login");

-- CreateIndex
CREATE UNIQUE INDEX "User_nickname_key" ON "public"."User"("nickname");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "public"."RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "FocusSession_status_endsAt_idx" ON "public"."FocusSession"("status", "endsAt");

-- CreateIndex
CREATE INDEX "FocusSession_userId_endsAt_idx" ON "public"."FocusSession"("userId", "endsAt");

-- CreateIndex
CREATE INDEX "Wallet_seasonKey_idx" ON "public"."Wallet"("seasonKey");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_seasonKey_key" ON "public"."Wallet"("userId", "seasonKey");

-- CreateIndex
CREATE UNIQUE INDEX "Ledger_reference_key" ON "public"."Ledger"("reference");

-- CreateIndex
CREATE INDEX "Ledger_userId_createdAt_idx" ON "public"."Ledger"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReward_userId_day_key" ON "public"."DailyReward"("userId", "day");

-- CreateIndex
CREATE INDEX "GameRound_status_expiresAt_idx" ON "public"."GameRound"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "GameRound_userId_createdAt_idx" ON "public"."GameRound"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonResult_userId_seasonKey_key" ON "public"."SeasonResult"("userId", "seasonKey");

-- CreateIndex
CREATE UNIQUE INDEX "Idempotency_userId_key_key" ON "public"."Idempotency"("userId", "key");

