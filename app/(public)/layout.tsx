import { db } from "@/lib/db/client";
import { sites } from "@/lib/db/schema";
import { generateOrganization, generateWebSite } from "@/lib/schema-ld";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const allSites = await db.select().from(sites).limit(1);
  const site = allSites[0];

  return (
    <>
      {site && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(generateOrganization(site)),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(generateWebSite(site)),
            }}
          />
        </>
      )}
      {children}
    </>
  );
}
