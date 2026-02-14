import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanup() {
  console.log("Starting cleanup...");

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  // 1. 処理済み（REGISTERED/SKIPPED）のスケジュールを全削除
  // ScheduleHistoryはonDelete: Cascadeで自動削除される
  const deletedProcessed = await prisma.pendingSchedule.deleteMany({
    where: {
      status: {
        in: ["REGISTERED", "SKIPPED"],
      },
    },
  });
  console.log(`Deleted ${deletedProcessed.count} processed schedules (REGISTERED/SKIPPED)`);

  // 2. 1日以上古いPENDINGスケジュールを削除
  const deletedOldPending = await prisma.pendingSchedule.deleteMany({
    where: {
      status: "PENDING",
      createdAt: {
        lt: oneDayAgo,
      },
    },
  });
  console.log(`Deleted ${deletedOldPending.count} old PENDING schedules (older than 1 day)`);

  // 3. 孤立したScheduleHistoryがあれば削除（念のため）
  // 通常はCascade削除されるが、何らかの理由で残っている場合
  const orphanedHistories = await prisma.scheduleHistory.deleteMany({
    where: {
      schedule: undefined,
    },
  });
  if (orphanedHistories.count > 0) {
    console.log(`Deleted ${orphanedHistories.count} orphaned schedule histories`);
  }

  console.log("Cleanup completed!");
}

cleanup()
  .catch((e) => {
    console.error("Cleanup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
