import ScrollBox, {importCdn } from "./$core$/ScrollBox";

//
export * from "./$core$/ScrollBox";
export default ScrollBox;

// @ts-ignore
Promise.try(importCdn, ["/externals/core/theme.js"])?.then?.((module)=>{
    // @ts-ignore
    module?.default?.();
}).catch(console.warn.bind(console));
