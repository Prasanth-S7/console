/*
  Warnings:

  - You are about to drop the column `inventoryPath` on the `Execution` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Execution" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "arguments" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "logPath" TEXT,
    "exitCode" INTEGER,
    "stdout" TEXT,
    "stderr" TEXT,
    "executedById" INTEGER NOT NULL,
    "playbookId" INTEGER NOT NULL,
    CONSTRAINT "Execution_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User" ("userId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Execution_playbookId_fkey" FOREIGN KEY ("playbookId") REFERENCES "Playbook" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Execution" ("arguments", "createdAt", "executedById", "exitCode", "finishedAt", "id", "logPath", "playbookId", "startedAt", "status", "stderr", "stdout") SELECT "arguments", "createdAt", "executedById", "exitCode", "finishedAt", "id", "logPath", "playbookId", "startedAt", "status", "stderr", "stdout" FROM "Execution";
DROP TABLE "Execution";
ALTER TABLE "new_Execution" RENAME TO "Execution";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
