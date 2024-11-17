import ScrollBox from "./$core$/ScrollBox";

//
export * from "./$core$/ScrollBox";
export default ScrollBox;

// @ts-ignore
import(/* @vite-ignore */ "/externals/core/theme.js").then((module)=>{
    // @ts-ignore
    module?.default?.();
}).catch(console.warn.bind(console));
