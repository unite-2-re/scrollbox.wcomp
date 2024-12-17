// @ts-ignore
import {zoomOf} from "/externals/lib/agate.js";

// @ts-ignore
import styles from "./ScrollBox.scss?inline&compress";

// @ts-ignore
import html from "./ScrollBox.html?raw";

//
const preInit = URL.createObjectURL(new Blob([styles], {type: "text/css"}));

//
export const UUIDv4 = () => {
    return crypto?.randomUUID ? crypto?.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16));
};

const onBorderObserve = new WeakMap<HTMLElement, Function[]>();
export const observeBorderBox = (element, cb) => {
    if (!onBorderObserve.has(element)) {
        const callbacks: Function[] = [];

        //
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.borderBoxSize) {
                    const borderBoxSize = entry.borderBoxSize[0];
                    if (borderBoxSize) {
                        callbacks.forEach((cb) => cb?.(borderBoxSize, observer));
                    }
                }
            }
        });

        //
        cb?.({
            inlineSize: element.offsetWidth,
            blockSize: element.offsetHeight,
        }, observer);

        //
        onBorderObserve.set(element, callbacks);
        observer.observe(element, {box: "border-box"});
    }

    //
    onBorderObserve.get(element)?.push(cb);
}

//
const delayed = new Map<string, Function | null>([]);

//
requestIdleCallback(async ()=>{
    while(true) {
        for (const dl of delayed.entries()) {
            dl[1]?.(); delayed.delete(dl[0]);
        }

        //
        try { await (new Promise((rs)=>requestAnimationFrame(rs))); } catch(e) { break; };
    }
}, {timeout: 1000});

//
addEventListener("beforeunload", (event) => { delayed.clear(); });
addEventListener("pagehide", (event) => { delayed.clear(); });

//
document.addEventListener("visibilitychange", () => {
    if (document.hidden) { delayed.clear(); };
});

//
const callByFrame = (pointerId, cb)=>{
    delayed.set(pointerId, cb);
}

//
export interface ScrollBarStatus {
    pointerId: number;
    scroll: number;
    delta: number;
    point: number;
}

//
export const setProperty = (target, name, value, importance = "")=>{
    if ("attributeStyleMap" in target) {
        const raw = target.attributeStyleMap.get(name);
        const prop = raw?.[0] ?? raw?.value;
        if (parseFloat(prop) != value && prop != value || prop == null) {
            //if (raw?.[0] != null) { raw[0] = value; } else
            if (raw?.value != null) { raw.value = value; } else
            { target.attributeStyleMap.set(name, value); };
        }
    } else {
        const prop = target?.style?.getPropertyValue?.(name);
        if (parseFloat(prop) != value && prop != value || prop == null) {
            target?.style?.setProperty?.(name, value, importance);
        }
    }
}

//
const borderBoxWidth  = Symbol("@content-box-width");
const borderBoxHeight = Symbol("@content-box-height");

//
class ScrollBar {
    scrollbar: HTMLDivElement;
    holder: HTMLElement;
    status: ScrollBarStatus;
    content: HTMLDivElement;
    uuid: string = "";
    uuid2: string = "";
    uuid3: string = "";

    //
    constructor({holder, scrollbar, content}, axis = 0) {
        this.scrollbar = scrollbar;
        this.holder    = holder;
        this.content   = content;
        this.uuid      = UUIDv4();
        this.uuid2     = UUIDv4();
        this.uuid3     = UUIDv4();
        this.status    = {
            delta: 0,
            scroll: 0,
            pointerId: -1,
            point: 0
        };

        //
        const status_w = new WeakRef(this.status);
        const weak     = new WeakRef(this);
        const computeScroll = (ev: any | null = null) => {
            const self = weak?.deref?.();
            if (self) {
                const sizePercent = Math.min(
                    self.content[[borderBoxWidth, borderBoxHeight][axis]] /
                    self.content[["scrollWidth", "scrollHeight"][axis]],
                    1
                );

                //
                setProperty(self.scrollbar, "--scroll-size", this.content[["scrollWidth", "scrollHeight"][axis]]);
                if (sizePercent >= 0.999) {
                    setProperty(self.scrollbar, "visibility", "collapse", "important");
                } else {
                    setProperty(self.scrollbar, "visibility", "visible", "important");
                }
            }
        };

        //
        const computeScrollPosition = ()=>{
            const self   = weak?.deref?.();
            const status = status_w?.deref?.();

            //
            if (status && status?.pointerId >= 0) {
                status.scroll += (status.point - status.delta) * ((self?.content?.[["scrollWidth", "scrollHeight"][axis]] || 0) / (self?.scrollbar?.[[borderBoxWidth, borderBoxHeight][axis]] || 1));
                status.delta   = status.point;

                //
                const realShift = status.scroll - self?.content?.[["scrollLeft", "scrollTop"][axis]];;

                //
                if (Math.abs(realShift) >= 0.001) {
                    self?.content?.scrollBy?.({
                        [["left", "top"][axis]]: realShift,
                        behavior: "instant",
                    });
                }
            }
        }

        //
        const moveScroll = (evc) => {
            const ev     = evc?.detail || evc;
            const self   = weak?.deref?.();
            const status = status_w?.deref?.();
            if (self && status && status?.pointerId == ev.pointerId) {
                evc?.stopPropagation?.();
                evc?.preventDefault?.();
                status.point = ev?.orient?.[axis] ?? (ev[["clientX", "clientY"][axis]] / zoomOf(self));
            }
        }

        //
        const stopScroll = (evc) => {
            const ev     = evc?.detail || evc;
            const status = status_w?.deref?.();
            const self   = weak?.deref?.();
            if (status && status?.pointerId == ev.pointerId) {
                evc?.stopPropagation?.();
                evc?.preventDefault?.();

                //
                status.scroll = self?.content?.[["scrollLeft", "scrollTop"][axis]] || 0;
                status.pointerId = -1;

                // @ts-ignore
                ev.target?.releasePointerCapture?.(ev.pointerId);

                //
                this.holder.removeEventListener("ag-pointermove", moveScroll);
                this.holder.removeEventListener("ag-pointerup", stopScroll);
                this.holder.removeEventListener("ag-pointercancel", stopScroll);
            }
        };

        //
        this.scrollbar
            ?.querySelector?.(".thumb")
            ?.addEventListener?.("pointerdown", (evc) => {
                const ev     = evc?.detail || evc;
                const status = status_w?.deref?.();
                const self   = weak?.deref?.();

                //
                if (self && status && status?.pointerId < 0) {
                    evc?.stopPropagation?.();
                    evc?.preventDefault?.();
                    ev?.target?.setPointerCapture?.(ev.pointerId);

                    //
                    status.pointerId = ev.pointerId || 0;
                    status.delta  = ev?.orient?.[axis] || ev[["clientX", "clientY"][axis]] / zoomOf(self);
                    status.point  = status.delta;
                    status.scroll = self?.content?.[["scrollLeft", "scrollTop"][axis]];

                    //
                    this.holder.addEventListener("pointermove", moveScroll);
                    this.holder.addEventListener("pointerup", stopScroll);
                    this.holder.addEventListener("pointercancel", stopScroll);

                    //
                    (async ()=>{
                        while(status && status?.pointerId >= 0) {
                            computeScrollPosition();
                            await new Promise((r)=>requestAnimationFrame(r));
                        }
                    })();
                }
            });

        //
        this.content.addEventListener("scroll", (ev)=>{
            const self = weak?.deref?.() as any;

            //
            if (!CSS.supports("timeline-scope", "--tm-x, --tm-y")) {
                setProperty(
                    self?.holder,
                    "--scroll-top",
                    (self?.content?.scrollTop || "0") as string
                );

                //
                setProperty(
                    self?.holder,
                    "--scroll-left",
                    (self?.content?.scrollLeft || "0") as string
                );
            }

            //
            self?.holder?.dispatchEvent?.(new CustomEvent("scroll-change", {
                detail: {
                    scrollTop: self.content.scrollTop,
                    scrollLeft: self.content.scrollLeft,
                },
            }));
        });

        //
        this.holder.addEventListener("u2-hidden", computeScroll);
        this.holder.addEventListener("u2-appear", computeScroll);
        (new MutationObserver(computeScroll)).observe(this.holder, { childList: true, subtree: true, characterData: false, attributes: false });

        //
        observeBorderBox(this.scrollbar, (box) => {
            const self = weak?.deref?.();
            if (self) {
                self.scrollbar[borderBoxWidth] = box.inlineSize;
                self.scrollbar[borderBoxHeight] = box.blockSize;
            }
        });

        //
        observeBorderBox(this.content, (box) => {
            const self = weak?.deref?.();
            if (self) {
                self.content[borderBoxWidth] = box.inlineSize;
                self.content[borderBoxHeight] = box.blockSize;
            }
        });

        //
        requestIdleCallback(computeScroll, {timeout: 1000});
    }
}



//
const regProp = (options: any)=>{
    try {
        CSS?.registerProperty?.(options);
    } catch(e) {
        console.warn(e);
    };
};

//
regProp?.({
    name: "--percent",
    syntax: "<number>",
    inherits: true,
    initialValue: "0",
});

//
regProp?.({
    name: "--percent-y",
    syntax: "<number>",
    inherits: true,
    initialValue: "0",
});

//
regProp?.({
    name: "--percent-x",
    syntax: "<number>",
    inherits: true,
    initialValue: "0",
});

//
export default class UIScrollBox extends HTMLElement {
    static observedAttributes = ["data-scroll-top", "data-scroll-left"];

    //
    #themeStyle?: HTMLStyleElement;
    #initialized: boolean = false;

    //
    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: "open"});
        const parser = new DOMParser();
        const dom = parser.parseFromString(html, "text/html");

        // @ts-ignore
        const THEME_URL = "/externals/core/theme.js";
        import(/* @vite-ignore */ "" + `${THEME_URL}`).then((module)=>{
            // @ts-ignore
            this.#themeStyle = module?.default?.(this.shadowRoot);
            if (this.#themeStyle) { this.shadowRoot?.appendChild?.(this.#themeStyle); }
        }).catch(console.warn.bind(console));

        //
        dom.querySelector("template")?.content?.childNodes.forEach(cp => {
            shadowRoot.appendChild(cp.cloneNode(true));
        });

        //
        const style = document.createElement("style");
        style.innerHTML = `@import url("${preInit}");`;
        shadowRoot.appendChild(style);
    }

    //
    #initialize() {
        if (this.#initialized) return this;
        this.#initialized = true;

        //
        const shadowRoot = this.shadowRoot;
        const content = shadowRoot?.querySelector?.(".content-box");

        //
        this["@scrollbar-x"] = new ScrollBar(
            {
                holder: this,
                content: shadowRoot?.querySelector(".content-box"),
                scrollbar: shadowRoot?.querySelector(".scrollbar-x"),
            },
            0
        );

        //
        this["@scrollbar-y"] = new ScrollBar(
            {
                holder: this,
                content: shadowRoot?.querySelector(".content-box"),
                scrollbar: shadowRoot?.querySelector(".scrollbar-y"),
            },
            1
        );

        //
        if (this.dataset.scrollTop || this.dataset.scrollLeft) {
            content?.scrollTo({
                top: parseFloat(this.dataset.scrollTop || "0") || 0,
                left: parseFloat(this.dataset.scrollLeft || "0") || 0,
                behavior: "instant",
            });

            //
            const event = new CustomEvent("scroll-set", {
                detail: {
                    scrollTop: this.dataset.scrollTop || 0,
                    scrollLeft: this.dataset.scrollLeft || 0,
                },
            });

            //
            this.dispatchEvent(event);
        }

        //
        return this;
    }

    //
    connectedCallback() {
        this.#initialize();
    }

    //
    attributeChangedCallback(name/*, oldValue, newValue*/) {
        //
        const content = this.shadowRoot?.querySelector(".content-box") as HTMLElement;

        //
        if (name == this?.dataset.scrollTop) {
            content?.scrollTo({
                top: parseFloat(this?.dataset.scrollTop || "0") || 0,
                left: content?.scrollLeft || 0,
                behavior: "instant",
            });

            //
            const event = new CustomEvent("scroll-set", {
                detail: {
                    scrollTop: parseFloat(this?.dataset.scrollTop || "0") || 0,
                    scrollLeft: parseFloat(this?.dataset.scrollLeft || "0") || 0,
                },
            });

            //
            this.dispatchEvent(event);
        }

        //
        if (name == this?.dataset.scrollLeft) {
            content?.scrollTo({
                top: this.scrollTop || 0,
                left: parseFloat(this?.dataset.scrollLeft || "0") || 0,
                behavior: "instant",
            });

            //
            const event = new CustomEvent("scroll-set", {
                detail: {
                    scrollTop: parseFloat(this?.dataset.scrollTop || "0") || 0,
                    scrollLeft: parseFloat(this?.dataset.scrollLeft || "0") || 0,
                },
            });

            //
            this.dispatchEvent(event);
        }
    }
}

//
customElements.define("ui-scrollbox", UIScrollBox);
