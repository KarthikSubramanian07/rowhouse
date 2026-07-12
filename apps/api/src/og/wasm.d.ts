/**
 * Ambient declaration so TypeScript accepts the static `.wasm` import that
 * wrangler precompiles into a `WebAssembly.Module` at build time.
 *
 * See render.ts:  import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
 */
declare module '*.wasm' {
  const wasmModule: WebAssembly.Module;
  export default wasmModule;
}
