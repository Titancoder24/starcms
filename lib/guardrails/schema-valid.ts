import type { GuardResult, PostForCheck } from "./types";

export async function checkSchemaValid({ post, site, author }: PostForCheck): Promise<GuardResult> {
  try {
    const { generateSchemaForPost } = await import("@/lib/schema-ld");
    if (!site) {
      return {
        code: "schema-valid",
        pass: false,
        severity: "error",
        message: "Cannot validate schema: site data is missing.",
        fix: "Ensure the post is associated with a valid site.",
      };
    }
    const schema = generateSchemaForPost(post, site, author ?? undefined);
    // Basic shape validation
    if (!schema["@context"] || !schema["@type"]) {
      throw new Error("Missing @context or @type");
    }
    return { code: "schema-valid", pass: true, severity: "error", message: "JSON-LD schema is valid.", fix: "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      code: "schema-valid",
      pass: false,
      severity: "error",
      message: `JSON-LD schema validation failed: ${msg}`,
      fix: "Review the post's author, site organization, and structured data fields. Ensure all required schema fields are populated.",
    };
  }
}
