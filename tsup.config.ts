import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  format: ["esm", "cjs"],
  dts: {
    compilerOptions: {
      // tsup's DTS worker internally sets baseUrl, which TS6 deprecated.
      // This suppresses the error until tsup ships a fix.
      ignoreDeprecations: "6.0",
    },
  },
  clean: true,
  splitting: true,
  shims: true,
  banner: ({ format }) => {
    if (format === "esm") {
      return {
        // Only cli.ts needs the shebang, but tsup applies banner to all entries.
        // The shebang in non-CLI files is harmless (ignored by Node when require'd/import'd).
        js: "",
      };
    }
    return {};
  },
});
