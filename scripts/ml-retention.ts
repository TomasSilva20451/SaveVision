async function main() {
  const { db } = await import("../src/lib/db");
  try {
    const result = await db.mlInvocationEvent.updateMany({
      where: { promptExpiresAt: { lte: new Date() }, promptExcerpt: { not: null } },
      data: { promptExcerpt: null, promptExpiresAt: null },
    });

    console.log(JSON.stringify({ purgedPromptExcerpts: result.count, executedAt: new Date().toISOString() }));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
