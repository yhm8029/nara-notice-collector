import {
  createProcurementCorpClientFromEnv,
  summarizeProcurementCorp
} from "./procurement-corp-client.js";

async function main(): Promise<void> {
  const businessNumber = process.argv[2];
  if (!businessNumber) {
    throw new Error("Usage: NARA_API_KEY=<key> tsx src/nara/check-procurement-corp.ts <business-number>");
  }

  const client = createProcurementCorpClientFromEnv();
  const corporations = await client.findByBusinessNumber(businessNumber, { numOfRows: 1 });

  const first = corporations[0];
  console.log(
    JSON.stringify(
      {
        count: corporations.length,
        first: first
          ? {
              representativeName: first.representativeName,
              companyName: first.companyName,
              businessNumber: first.businessNumber,
              phoneNumber: first.phoneNumber,
              fields: summarizeProcurementCorp(first.raw)
            }
          : null
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
